import FormatPreview from "@/components/format-preview"
import { formatNumber, formatPercent, formatUsd } from "@/components/dashboard/format"
import { byPlacement, byPlatform } from "@/lib/conversions/insights"
import type { Conversion } from "@/lib/conversions/types"
import { demoCampaign } from "@/lib/demo-campaign"
import { cn } from "@/lib/utils"

export const platformColors = {
  meta: "bg-gradient-to-r from-blue-500 to-violet-500",
  google: "bg-gradient-to-r from-amber-400 to-emerald-400",
  unmatched: "bg-muted-foreground/30",
} as const

// Which platform and placement each conversion was matched to.
export default function AttributionBreakdown({ conversions }: { conversions: Conversion[] }) {
  const platforms = byPlatform(conversions)
  const placementTallies = byPlacement(conversions)
  const total = conversions.length || 1
  const segments = [
    { key: "meta", label: "Meta", ...platforms.meta },
    { key: "google", label: "Google", ...platforms.google },
    { key: "unmatched", label: "Not matched", ...platforms.unmatched },
  ] as const
  const maxPlacement = Math.max(...[...placementTallies.values()].map((t) => t.count), 1)
  // Show the placement's own ad in its preview.
  const previewImage = demoCampaign.ads[0]?.image

  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Where conversions came from</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each customer matched to the last ad they saw, by email, phone number, or cookie.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex h-9 overflow-hidden rounded-xl text-sm font-semibold">
          {segments.map((s) =>
            s.count ? (
              <div
                key={s.key}
                className={cn(
                  "flex items-center justify-center truncate px-2",
                  platformColors[s.key],
                  s.key === "meta" ? "text-white" : "text-slate-900",
                )}
                style={{ width: `${(s.count / total) * 100}%` }}
              >
                {formatPercent(s.count / total, 0)}
              </div>
            ) : null,
          )}
        </div>
        <ul className="grid gap-2 text-sm sm:grid-cols-3">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", platformColors[s.key])} />
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">
                {formatNumber(s.count)} · {formatUsd(s.revenue)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="flex flex-col gap-2">
        {demoCampaign.placements.map((p) => {
          const tally = placementTallies.get(p.id)!
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-2.5 pr-4">
              <FormatPreview format={p.format} image={previewImage} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-sm tabular-nums">
                    <span className="font-semibold">{formatNumber(tally.count)}</span>
                    <span className="text-muted-foreground"> · {formatUsd(tally.revenue)}</span>
                  </p>
                </div>
                <p className="text-xs text-primary">{p.formatLabel}</p>
                <div className="h-1.5 rounded-full bg-background">
                  <div
                    className={cn("h-full rounded-full", platformColors[p.platform])}
                    style={{ width: `${(tally.count / maxPlacement) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
