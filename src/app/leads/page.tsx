import type { Metadata } from "next"
import { after } from "next/server"
import { Download } from "lucide-react"

import AppHeader from "@/components/app-header"
import AssistantLauncher from "@/components/dashboard/assistant-launcher"
import { assistantProvider } from "@/lib/assistant/shared"
import { countSince } from "@/components/leads/lead-list"
import LeadsTable, { type LeadRow } from "@/components/leads/leads-table"
import LiveRefresh from "@/components/leads/live-refresh"
import PhoneCalls from "@/components/leads/phone-calls"
import SendingCheck from "@/components/leads/sending-check"
import WebhookSetup from "@/components/leads/webhook-setup"
import { formatNumber } from "@/components/dashboard/format"
import { buttonVariants } from "@/components/ui/button"
import { DATA_MANAGER_LIBRARY } from "@/lib/google/data-manager"
import { cn } from "@/lib/utils"
import { requireSession } from "@/lib/auth/session"
import { activeAccount } from "@/lib/google/active-account"
import { tryGetCalls } from "@/lib/google/calls"
import { catchUp, leadsVersion } from "@/lib/leads/background"
import { leadSource } from "@/lib/leads/source"
import { listLeads, listQrCodes } from "@/lib/leads/store"
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
    gclid: t.gclid || t.gbraid || t.wbraid,
    landingPage: t.landingPage && /^https?:\/\//.test(t.landingPage) ? t.landingPage : undefined,
    landingPath: pagePath(t.landingPage),
    referrer: t.referrer,
    notes: lead.notes,
    status: lead.status ?? "new",
    statusBy: lead.statusBy,
    statusRule: lead.statusRule,
    score: lead.score,
    google: googleState(lead),
  }
}

// One line on what Google Ads has heard about this lead, for the table.
function googleState(lead: Lead): LeadRow["google"] {
  const main = mainGoogleState(lead)
  // Reported as an invalid lead (reporting only): say so when nothing else is going on with it.
  const invalid = lead.conversions?.invalid
  if (!invalid || invalid.retraction || (main && !["retracted", "retracting", "held"].includes(main.state))) return main
  const also = main?.state === "retracted" ? "Its earlier conversion was taken back. " : ""
  if (invalid.state === "sent") return { state: "invalid", detail: `${also}Reporting only: Google won't bid for leads like this, and its reports show which ads bring them.` }
  if (invalid.state === "pending") return { state: "invalid_pending", detail: `${also}Reporting it to Google as an invalid lead (reporting only).` }
  return main ?? { state: invalid.state === "failed" ? "failed" : "skipped", detail: invalid.error }
}

function mainGoogleState(lead: Lead): LeadRow["google"] {
  const { invalid: _invalid, ...rest } = lead.conversions ?? {}
  void _invalid
  // (A parked entry only keeps a resend id; there's nothing to show for it.)
  const all = Object.values(rest).filter((c) => !c?.parked)
  // Taken back (or being taken back) because the lead turned out Not interested.
  const backs = all.map((c) => c?.retraction).filter(Boolean)
  if (backs.length) {
    const failed = backs.find((r) => r!.state === "failed")
    if (failed) return { state: "retract_failed", detail: failed.error }
    if (backs.some((r) => r!.state === "pending")) return { state: "retracting", detail: "Not interested: telling Google to stop counting it." }
    return { state: "retracted", detail: "Not interested: Google no longer counts it as a good lead." }
  }
  if (!all.length) return lead.googleBlockedBy ? { state: "held", detail: `Not sent: rule “${lead.googleBlockedBy}”` } : undefined
  const order = ["failed", "pending", "skipped", "sent"] as const
  const worst = order.find((s) => all.some((c) => c?.state === s))!
  const entry = all.find((c) => c?.state === worst)!
  // Once Google has checked what it was sent, say what it decided.
  const decided = all.map((c) => c?.google).filter(Boolean)
  if (worst === "sent" && decided.some((g) => g!.status === "rejected")) {
    return { state: "rejected", detail: `Google: ${decided.find((g) => g!.status === "rejected")!.reason}` }
  }
  if (worst === "sent" && decided.length && decided.every((g) => g!.status === "accepted")) {
    return { state: "accepted", detail: decided.map((g) => g!.reason).filter(Boolean).join("; ") || "Google counts it. It shows in Google Ads under the date of the ad click." }
  }
  // Google is asked for 3 days; after that it's simply sent (Google took it in and never objected).
  if (worst === "sent" && all.some((c) => c?.requestId && Date.now() - Date.parse(c.lastTry ?? c.at) < 3 * 86_400_000)) {
    const asked = all.map((c) => c?.google).filter((g) => g?.status === "processing").sort((a, b) => b!.checkedAt.localeCompare(a!.checkedAt))[0]
    const at = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    const sentAt = all.map((c) => c?.lastTry ?? c?.at).filter(Boolean).sort().at(-1)
    const progress = asked
      ? asked.reason
        ? ` Last asked ${at(asked.checkedAt)}: ${asked.reason}. The app tries again every 30 minutes.`
        : ` Last asked ${at(asked.checkedAt)}: still checking. The app asks again every 30 minutes.`
      : sentAt
        ? ` Sent ${at(sentAt)}. The app first asks Google 30 minutes after sending.`
        : ""
    return { state: "checking", detail: `Google has it and is checking it (30 minutes to 24 hours). This is normal.${progress}` }
  }
  const why = [entry.rule && `Rule “${entry.rule}”`, entry.value !== undefined && entry.value !== 1 && `worth $${entry.value}`].filter(Boolean).join(", ")
  return { state: worst, detail: entry.error ?? ([why, entry.matchedBy && `matched by ${entry.matchedBy}`].filter(Boolean).join(" · ") || undefined) }
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

export const metadata: Metadata = { title: "Leads · One Marketing Command Center" }

export default async function LeadsPage() {
  const user = await requireSession("/leads")
  // New leads from the WordPress site (checked at most every 30 seconds) and conversions for Google
  // Ads are handled after the page is sent, so it never waits on them; the page updates itself
  // when they change anything (LiveRefresh).
  after(() => catchUp(user.sub))
  // The version first: a change saved while the leads are read then still shows on the next check.
  const version = await leadsVersion()
  const [qrCodes, leads, calls] = await Promise.all([listQrCodes(), listLeads(), loadCalls(user.sub)])
  const placements = new Map(qrCodes.map((c) => [c.id, c.placement]))
  const callCount = calls && "calls" in calls ? calls.calls.length : null
  const missed = calls && "calls" in calls ? calls.calls.filter((c) => c.missed).length : 0

  // Conversions held back by a set-up step Google needs, so the page can say what to do.
  const waiting = leads.flatMap((l) => Object.values(l.conversions ?? {})).filter((c) => c?.state === "pending" && c.waitingFor)

  // Leads Google Ads hasn't taken yet (failed, or still waiting after a try), and the latest reason.
  const stuckEntries = leads
    .flatMap((l) => Object.values(l.conversions ?? {}))
    .filter((c) => c && (c.state === "failed" || (c.state === "pending" && c.lastTry)))
  const lastError = stuckEntries.sort((a, b) => (b!.lastTry ?? "").localeCompare(a!.lastTry ?? ""))[0]?.error

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
                Every lead is scored and good ones are sent to Google Ads automatically. Set a lead&apos;s <strong>Status</strong> as you
                work it: <strong>Interested</strong> and <strong>Closed deal</strong> are sent to Google Ads too.
              </p>
              {stuckEntries.length > 0 && (
                <div className="mt-4">
                  <SendingCheck stuck={stuckEntries.length} lastError={lastError} />
                </div>
              )}
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
      <LiveRefresh version={version} />
      <AssistantLauncher enabled={assistantProvider() !== null} />
    </div>
  )
}
