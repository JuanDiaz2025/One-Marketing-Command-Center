import type { Metadata } from "next"
import { Download } from "lucide-react"

import AppHeader from "@/components/app-header"
import AssistantLauncher from "@/components/dashboard/assistant-launcher"
import { assistantProvider } from "@/lib/assistant/shared"
import { countSince } from "@/components/leads/lead-list"
import LeadsTable, { type LeadRow } from "@/components/leads/leads-table"
import LiveRefresh from "@/components/leads/live-refresh"
import PhoneCalls from "@/components/leads/phone-calls"
import ScoringSettings from "@/components/leads/scoring-settings"
import WebhookSetup from "@/components/leads/webhook-setup"
import { formatNumber } from "@/components/dashboard/format"
import { buttonVariants } from "@/components/ui/button"
import { DATA_MANAGER_LIBRARY } from "@/lib/google/data-manager"
import { cn } from "@/lib/utils"
import { requireSession } from "@/lib/auth/session"
import { activeAccount } from "@/lib/google/active-account"
import { tryGetCalls } from "@/lib/google/calls"
import { sendPendingConversions } from "@/lib/google/offline-conversions"
import { syncWordPress } from "@/lib/leads/wordpress"
import { leadSource } from "@/lib/leads/source"
import { getScoringSettings } from "@/lib/leads/scoring"
import { listLeads, listQrCodes, scoreUnscored } from "@/lib/leads/store"
import { leadChannel, pagePath } from "@/lib/leads/tracking"
import type { Lead } from "@/lib/leads/types"

// One spreadsheet row per lead. Dates are formatted here, on this computer, in its time zone.
function toRow(lead: Lead, placements: Map<string, string>): LeadRow {
  const t = lead.tracking ?? {}
  return {
    id: lead.id,
    receivedAt: lead.createdAt,
    received: new Date(lead.createdAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    address: lead.propertyAddress,
    channel: leadChannel(lead),
    form: leadSource(lead, placements).replace(/^Website( · )?/, ""),
    utmSource: t.utmSource,
    utmMedium: t.utmMedium,
    utmCampaign: t.utmCampaign,
    utmTerm: t.utmTerm,
    utmContent: t.utmContent,
    gclid: t.gclid,
    landingPage: t.landingPage && /^https?:\/\//.test(t.landingPage) ? t.landingPage : undefined,
    landingPath: pagePath(t.landingPage),
    referrer: t.referrer,
    notes: lead.notes,
    status: lead.status ?? "new",
    statusBy: lead.statusBy,
    score: lead.score,
    google: googleState(lead),
  }
}

// One line on what Google Ads has heard about this lead, for the table.
function googleState(lead: Lead): LeadRow["google"] {
  const all = Object.values(lead.conversions ?? {})
  if (!all.length) return undefined
  const order = ["failed", "pending", "skipped", "sent"] as const
  const worst = order.find((s) => all.some((c) => c?.state === s))!
  const entry = all.find((c) => c?.state === worst)!
  return { state: worst, detail: entry.error ?? (entry.matchedBy ? `Matched by ${entry.matchedBy}` : undefined) }
}

// Phone calls from Google Ads, or null when Google Ads isn't connected.
async function loadCalls(sub: string) {
  try {
    const active = await activeAccount(sub)
    return active ? await tryGetCalls(active.connection, active.account) : null
  } catch {
    return { error: "Couldn't reach Google Ads for calls." }
  }
}

// Offline conversions waiting to go to Google Ads (new ones, and retries at most hourly).
async function sendConversions(sub: string) {
  try {
    const active = await activeAccount(sub)
    if (active) await sendPendingConversions(active.connection, active.account)
  } catch (error) {
    console.error("Couldn't send conversions to Google Ads:", error)
  }
}

export const metadata: Metadata = { title: "Leads · One Marketing Command Center" }

export default async function LeadsPage() {
  const user = await requireSession("/leads")
  // Pick up anything new saved on the WordPress site first (at most every 30 seconds), waiting up
  // to 3 seconds for it; a slower check shows its leads on the next refresh.
  await Promise.race([
    Promise.all([scoreUnscored().then(() => syncWordPress()), sendConversions(user.sub)]),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
  const [qrCodes, leads, calls, scoring] = await Promise.all([listQrCodes(), listLeads(), loadCalls(user.sub), getScoringSettings()])
  const placements = new Map(qrCodes.map((c) => [c.id, c.placement]))
  const callCount = calls && "calls" in calls ? calls.calls.length : null
  const missed = calls && "calls" in calls ? calls.calls.filter((c) => c.missed).length : 0

  // Conversions held back by a set-up step Google needs, so the page can say what to do.
  const waiting = leads.flatMap((l) => Object.values(l.conversions ?? {})).filter((c) => c?.state === "pending" && c.waitingFor)

  const kpis = [
    { label: "Form leads, last 7 days", value: formatNumber(countSince(leads, 7)) },
    { label: "Form leads, last 30 days", value: formatNumber(countSince(leads, 30)) },
    {
      label: "Calls, last 30 days",
      value: callCount === null ? "–" : formatNumber(callCount),
      note: missed ? `${missed} missed` : undefined,
    },
    { label: "Form leads, all time", value: formatNumber(leads.length) },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/leads" user={user} />
      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 pt-8 pb-28 sm:px-6 lg:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Every lead from your website forms, as it comes in.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {leads.length > 0 && (
              <a href="/leads/export" className={buttonVariants({ variant: "outline", size: "lg", className: "h-11 px-5" })}>
                <Download data-icon="inline-start" />
                Export CSV
              </a>
            )}
          </div>
        </div>

        {waiting.length > 0 && (
          <section className="rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 p-5 text-amber-950">
            <h2 className="text-lg font-semibold">
              {waiting.length} conversion{waiting.length === 1 ? " is" : "s are"} waiting to go to Google Ads
            </h2>
            <p className="mt-1">
              Google now takes offline conversions through its Data Manager API. Two one-time steps, then they&apos;re sent by
              themselves within a few minutes:
            </p>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              <li>
                <strong>Turn on the Data Manager API:</strong> open{" "}
                <a href={DATA_MANAGER_LIBRARY} target="_blank" rel="noreferrer" className="font-medium underline">
                  the Data Manager API page in Google Cloud
                </a>
                , sign in with the Google account that made the app&apos;s sign-in settings, make sure the same project is picked at the
                top, and click <strong>Enable</strong>.
              </li>
              <li>
                <strong>Allow it in the app:</strong>{" "}
                <a href="/api/auth/google?intent=ads" className="font-medium underline">
                  connect Google Ads again
                </a>{" "}
                with the account you use for Google Ads, and leave every box ticked when Google asks.
              </li>
            </ol>
          </section>
        )}

        <section aria-label="Lead counts" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className={cn(
                "rounded-2xl border bg-card p-5 shadow-xs",
                kpi.note && "border-destructive/40 bg-destructive/5",
              )}
            >
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{kpi.value}</p>
              {kpi.note && <p className="mt-1 text-sm font-medium text-destructive">{kpi.note}</p>}
            </div>
          ))}
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">All leads</h2>
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              Live: new leads appear here on their own
            </span>
          </div>
          {leads.length ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Set a lead&apos;s <strong>Status</strong> as you work it. <strong>Interested</strong> (and Appointment, Offer made) and{" "}
                <strong>Closed deal</strong> are sent back to Google Ads as conversions, so Google learns which clicks bring real
                sellers. They&apos;re matched by the lead&apos;s Google click ID, or by their email and phone, which are scrambled
                first. Google never sees them in plain text.
              </p>
              <ScoringSettings autoStatus={scoring.autoStatus} />
              <div className="mt-4">
                <LeadsTable rows={leads.map((l) => toRow(l, placements))} />
              </div>
            </>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              No leads yet. Connect your website form below.
            </p>
          )}
        </section>

        <PhoneCalls result={calls} />

        <WebhookSetup websiteLeads={leads.filter((l) => !l.qrCodeId).length} />
      </main>
      <LiveRefresh />
      <AssistantLauncher enabled={assistantProvider() !== null} />
    </div>
  )
}
