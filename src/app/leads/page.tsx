import type { Metadata } from "next"
import Link from "next/link"
import { Download, Plus, QrCode } from "lucide-react"

import AppHeader from "@/components/app-header"
import AssistantLauncher from "@/components/dashboard/assistant-launcher"
import { assistantProvider } from "@/lib/assistant/shared"
import LeadList, { countSince } from "@/components/leads/lead-list"
import StatusBadge from "@/components/leads/status-badge"
import WebhookSetup from "@/components/leads/webhook-setup"
import ToggleActiveButton from "@/components/leads/toggle-active-button"
import { formatDate, formatNumber } from "@/components/dashboard/format"
import { buttonVariants } from "@/components/ui/button"
import { requireSession } from "@/lib/auth/session"
import { listLeads, listQrCodes } from "@/lib/leads/store"

export const metadata: Metadata = { title: "Leads · One Marketing Command Center" }

export default async function LeadsPage() {
  const user = await requireSession("/leads")
  const [qrCodes, leads] = await Promise.all([listQrCodes(), listLeads()])

  const kpis = [
    { label: "Last 7 days", value: formatNumber(countSince(leads, 7)) },
    { label: "Last 30 days", value: formatNumber(countSince(leads, 30)) },
    { label: "All time", value: formatNumber(leads.length) },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/leads" user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-8 pb-28 sm:px-6 lg:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Leads from your website forms and from QR codes on yard signs, postcards and flyers,
              all in one list.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {leads.length > 0 && (
              <a href="/leads/export" className={buttonVariants({ variant: "outline", size: "lg", className: "h-11 px-5" })}>
                <Download data-icon="inline-start" />
                Export CSV
              </a>
            )}
            <Link href="/leads/qr/new" className={buttonVariants({ size: "lg", className: "h-11 px-5" })}>
              <Plus data-icon="inline-start" />
              Create QR code
            </Link>
          </div>
        </div>

        <section aria-label="Lead counts" className="grid grid-cols-3 gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl border bg-card p-5 shadow-xs">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{kpi.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          <h2 className="text-lg font-semibold">Latest leads</h2>
          {leads.length ? (
            <LeadList leads={leads.slice(0, 50)} qrCodes={qrCodes} />
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              No leads yet. Connect your website form below, or create a QR code.
            </p>
          )}
        </section>

        <WebhookSetup websiteLeads={leads.filter((l) => !l.qrCodeId).length} />

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Your QR codes</h2>
          {qrCodes.length ? (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {qrCodes.map((code) => {
                const mine = leads.filter((l) => l.qrCodeId === code.id)
                return (
                  <li key={code.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <QrCode className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="leading-tight font-semibold">{code.placement}</h3>
                          <p className="truncate text-xs text-muted-foreground">{code.headline}</p>
                        </div>
                      </div>
                      <StatusBadge active={code.active} />
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Leads</dt>
                        <dd className="text-xl font-semibold">{formatNumber(mine.length)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Latest</dt>
                        <dd className="text-xl font-semibold">
                          {mine[0] ? formatDate(mine[0].createdAt.slice(0, 10)) : "–"}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-auto flex flex-wrap items-center gap-1">
                      <Link href={`/leads/qr/${code.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                        View QR
                      </Link>
                      <Link href={`/leads/qr/${code.id}/edit`} className={buttonVariants({ variant: "ghost", size: "lg" })}>
                        Edit
                      </Link>
                      <ToggleActiveButton id={code.id} active={code.active} />
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
              You haven&apos;t made a QR code yet.
            </p>
          )}
        </section>
      </main>
      <AssistantLauncher enabled={assistantProvider() !== null} />
    </div>
  )
}
