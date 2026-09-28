import { costPerConversion, returnOnAdSpend, type DashboardData } from "@/lib/dashboard-data"
import { demoCampaign } from "@/lib/demo-campaign"
import { formatNumber, formatPercent, formatUsd } from "@/components/dashboard/format"

export default function KpiCards({ data }: { data: DashboardData }) {
  const { totals, summary } = data
  const kpis = [
    {
      label: "Spend",
      value: formatUsd(data.spent),
      note: `of your ${formatUsd(demoCampaign.monthlyBudget)} monthly budget`,
    },
    {
      label: "Conversions from ads",
      value: formatNumber(totals.conversions),
      note: `${formatPercent(summary.matchedShare, 0)} of ${formatNumber(summary.count)} in-store QR conversions`,
    },
    {
      label: "Revenue from ads",
      value: formatUsd(totals.revenue),
      note: `${formatUsd(costPerConversion(totals))} per conversion`,
    },
    {
      label: "Return on ad spend",
      value: `${returnOnAdSpend(totals).toFixed(1)}×`,
      note: "revenue ÷ spend",
    },
  ]

  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-2xl border bg-card p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">{kpi.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{kpi.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>
        </div>
      ))}
    </section>
  )
}
