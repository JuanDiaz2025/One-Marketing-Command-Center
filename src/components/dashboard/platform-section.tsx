import FormatPreview from "@/components/format-preview"
import { platformBg, platformStroke } from "@/components/dashboard/platform-colors"
import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatUsd,
} from "@/components/dashboard/format"
import TrendChart from "@/components/dashboard/trend-chart"
import {
  clickThroughRate,
  costPerConversion,
  returnOnAdSpend,
  type PlatformPerformance,
} from "@/lib/dashboard-data"
import { demoCampaign } from "@/lib/demo-campaign"
import { cn } from "@/lib/utils"

export default function PlatformSection({ platform }: { platform: PlatformPerformance }) {
  const t = platform.totals
  const metrics = [
    { label: "Spend", value: formatUsd(t.spend), sub: `${platform.budgetShare}% of budget` },
    { label: "Impressions", value: formatCompact(t.impressions), sub: "times your ads were shown" },
    {
      label: "Clicks",
      value: formatNumber(t.clicks),
      sub: `${formatPercent(clickThroughRate(t))} click rate`,
    },
    { label: "Conversions", value: formatNumber(t.conversions), sub: "in-store, from QR codes" },
    {
      label: "Revenue",
      value: formatUsd(t.revenue),
      sub: `${returnOnAdSpend(t).toFixed(1)}× return on spend`,
    },
    {
      label: "Cost per conversion",
      value: formatUsd(costPerConversion(t)),
      sub: "spend ÷ conversions",
    },
  ]
  const preview = demoCampaign.ads[0]?.image

  return (
    <section
      id={platform.id}
      aria-labelledby={`${platform.id}-title`}
      className="scroll-mt-20 rounded-2xl border bg-card p-5 shadow-xs sm:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${platform.id}-title`} className="flex items-center gap-2.5 text-lg font-semibold">
          <span className={cn("size-3 rounded-full", platformBg[platform.id])} aria-hidden="true" />
          {platform.name}
          <span className="text-sm font-normal text-muted-foreground">{platform.detail}</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          {platform.placements.length} placements picked by One Marketing Command Center
        </p>
      </header>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label}>
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight">{m.value}</dd>
              <dd className="text-xs text-muted-foreground">{m.sub}</dd>
            </div>
          ))}
        </dl>
        <TrendChart
          data={platform.daily}
          color={platformStroke[platform.id]}
          label="Conversions per day"
        />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">{platform.name} placements</caption>
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                Placement
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Spend
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Impr.
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Clicks
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Conv.
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Revenue
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Cost / conv.
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {platform.placements.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  <span className="flex items-center gap-3">
                    <FormatPreview format={p.format} image={preview} size="sm" />
                    <span className="flex flex-col">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-primary">{p.formatLabel}</span>
                    </span>
                  </span>
                </th>
                <td className="py-2 pr-3 text-right">{formatUsd(p.spend)}</td>
                <td className="py-2 pr-3 text-right">{formatCompact(p.impressions)}</td>
                <td className="py-2 pr-3 text-right">{formatNumber(p.clicks)}</td>
                <td className="py-2 pr-3 text-right">{formatNumber(p.conversions)}</td>
                <td className="py-2 pr-3 text-right">{formatUsd(p.revenue)}</td>
                <td className="py-2 text-right font-medium">
                  {p.conversions ? formatUsd(costPerConversion(p)) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
