import BarList from "@/components/dashboard/bar-list"
import { platformBg } from "@/components/dashboard/platform-colors"
import { formatNumber, formatUsd } from "@/components/dashboard/format"
import { costPerConversion, type PlacementPerformance } from "@/lib/dashboard-data"

// Cheapest placements first: where auto mode puts more of the budget.
export default function ConversionComparison({
  placements,
}: {
  placements: PlacementPerformance[]
}) {
  const items = placements
    .filter((p) => p.conversions > 0)
    .sort((a, b) => costPerConversion(a) - costPerConversion(b))
    .map((p) => ({
      key: p.id,
      label: p.name,
      value: costPerConversion(p),
      valueLabel: formatUsd(costPerConversion(p)),
      barClassName: platformBg[p.platform],
      details: [
        `${formatNumber(p.conversions)} conversions from ${formatUsd(p.spend)}`,
        `${formatUsd(p.revenue)} revenue`,
      ],
    }))

  return (
    <section
      aria-labelledby="comparison-title"
      className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6"
    >
      <h2 id="comparison-title" className="text-lg font-semibold">
        Cost per conversion by placement
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Lower is better. Auto mode shifts budget toward the top of this list. Hover a bar for
        details.
      </p>
      <div className="mt-5">
        <BarList items={items} labelWidth="8.5rem" />
      </div>
    </section>
  )
}
