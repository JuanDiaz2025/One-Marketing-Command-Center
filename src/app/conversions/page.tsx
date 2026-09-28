import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Plus, QrCode, RefreshCw } from "lucide-react"

import AppHeader from "@/components/app-header"
import AttributionBreakdown from "@/components/conversions/attribution-breakdown"
import ConversionList from "@/components/conversions/conversion-list"
import StatusBadge from "@/components/conversions/status-badge"
import ToggleActiveButton from "@/components/conversions/toggle-active-button"
import TopAds from "@/components/conversions/top-ads"
import { formatDate, formatNumber, formatPercent, formatUsd } from "@/components/dashboard/format"
import { buttonVariants } from "@/components/ui/button"
import { byQrCode, inPeriod, summarize } from "@/lib/conversions/insights"
import { listConversions, listQrCodes } from "@/lib/conversions/store"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Conversion feed · AdPilot" }

const periods = [
  { id: "all", label: "All time", days: undefined },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "7d", label: "Last 7 days", days: 7 },
] as const

const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

export default async function ConversionFeedPage({ searchParams }: PageProps<"/conversions">) {
  await connection()
  const q = await searchParams
  const period = periods.find((p) => p.id === q.period) ?? periods[0]
  const [qrCodes, all] = await Promise.all([listQrCodes(), listConversions()])

  // Periods count back from the latest conversion, so the demo data always has something to show.
  const latest = all.at(-1)?.createdAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  const conversions = period.days ? inPeriod(all, shift(latest, 1 - period.days)) : all
  const stats = summarize(conversions)
  const perCode = byQrCode(conversions)
  const recent = [...conversions].reverse().slice(0, 12)

  const kpis = [
    {
      label: "Conversions",
      value: formatNumber(stats.count),
      note: `${formatNumber(stats.newCustomers)} new customers`,
    },
    {
      label: "Revenue",
      value: formatUsd(stats.revenue),
      note: `${formatUsd(stats.avgOrder)} average order`,
    },
    {
      label: "Matched to an ad",
      value: formatPercent(stats.matchedShare, 0),
      note: "by email, phone, or cookie",
    },
    {
      label: "Sent to ad platforms",
      value: formatNumber(stats.count),
      note: "Meta and Google, automatically",
    },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/conversions" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Conversion feed</h1>
              <p className="mt-1 max-w-2xl text-muted-foreground">
                Every in-store conversion from your QR codes, matched to the ad that drove it and
                fed back into Meta and Google to sharpen your targeting.
              </p>
            </div>
            <Link
              href="/conversions/qr/new"
              className={buttonVariants({ size: "lg", className: "h-11 px-5" })}
            >
              <Plus data-icon="inline-start" />
              Create QR code
            </Link>
          </div>
          <nav aria-label="Period" className="flex flex-wrap gap-1.5 text-sm">
            {periods.map((p) => (
              <Link
                key={p.id}
                href={p.id === "all" ? "/conversions" : `/conversions?period=${p.id}`}
                aria-current={p.id === period.id ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1",
                  p.id === period.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </div>

        <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl border bg-card p-5 shadow-xs">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{kpi.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <AttributionBreakdown conversions={conversions} />
          <TopAds conversions={conversions} />
        </div>

        <section className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Latest conversions</h2>
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <RefreshCw className="size-3.5" />
              Each one is sent back to Meta and Google as it happens
            </p>
          </div>
          {recent.length ? (
            <ConversionList conversions={recent} qrCodes={qrCodes} />
          ) : (
            <p className="py-6 text-sm text-muted-foreground">No conversions in this period yet.</p>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Your QR codes</h2>
            <p className="text-sm text-muted-foreground">
              Each code is a conversion source. Customers scan it, add their email or phone, and get
              their offer.
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {qrCodes.map((code) => {
              const tally = perCode.get(code.id)
              return (
                <li
                  key={code.id}
                  className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <QrCode className="size-5" />
                      </span>
                      <div>
                        <h3 className="leading-tight font-semibold">{code.placement}</h3>
                        <p className="text-xs text-muted-foreground">{code.headline}</p>
                      </div>
                    </div>
                    <StatusBadge active={code.active} />
                  </div>
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Conversions</dt>
                      <dd className="text-xl font-semibold">{formatNumber(tally?.count ?? 0)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Revenue</dt>
                      <dd className="text-xl font-semibold">{formatUsd(tally?.revenue ?? 0)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Last one</dt>
                      <dd className="text-xl font-semibold">
                        {tally?.last ? formatDate(tally.last.slice(0, 10)) : "–"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex flex-wrap items-center gap-1">
                    <Link
                      href={`/conversions/qr/${code.id}`}
                      className={buttonVariants({ variant: "outline", size: "lg" })}
                    >
                      View QR
                    </Link>
                    <Link
                      href={`/conversions/qr/${code.id}/edit`}
                      className={buttonVariants({ variant: "ghost", size: "lg" })}
                    >
                      Edit
                    </Link>
                    <ToggleActiveButton id={code.id} active={code.active} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </main>
    </div>
  )
}
