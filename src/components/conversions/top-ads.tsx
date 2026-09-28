import { FlaskConical, TrendingUp } from "lucide-react"

import { formatNumber, formatUsd } from "@/components/dashboard/format"
import { byAd } from "@/lib/conversions/insights"
import type { Conversion } from "@/lib/conversions/types"
import { demoCampaign } from "@/lib/demo-campaign"
import { cn } from "@/lib/utils"

// The campaign's ads ranked by conversions: the A/B test so far.
export default function TopAds({
  conversions,
  impressions,
}: {
  conversions: Conversion[]
  // Impressions per ad, when known, to show a conversion rate.
  impressions?: Map<string, number>
}) {
  const tallies = byAd(conversions)
  const ranked = demoCampaign.ads
    .map((ad) => ({ ad, ...(tallies.get(ad.id) ?? { count: 0, revenue: 0 }) }))
    .sort((a, b) => b.count - a.count)
  const total = ranked.reduce((sum, r) => sum + r.count, 0) || 1

  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FlaskConical className="size-5 text-primary" />
          Your ads, A/B tested
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversions from Reels, Stories, Feed, and Shorts, by ad. The platforms put more budget
          behind the leader.
        </p>
      </div>
      <ul className="grid grid-cols-3 gap-3">
        {ranked.map(({ ad, count, revenue }, i) => {
          const shown = impressions?.get(ad.id)
          return (
            <li key={ad.id} className="flex flex-col gap-2">
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl",
                  i === 0 && "ring-3 ring-lime-400 ring-offset-2 ring-offset-card",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ad.image}
                  alt={ad.headline}
                  className="aspect-[9/16] w-full object-cover"
                />
                {i === 0 && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-lime-300 px-2 py-0.5 text-[11px] font-semibold text-lime-950">
                    <TrendingUp className="size-3" />
                    Leading
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm leading-tight font-semibold">{ad.headline}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatNumber(count)} conversions · {formatUsd(revenue)}
                </p>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", i === 0 ? "bg-lime-400" : "bg-primary/60")}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
                {shown ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {((count / shown) * 1000).toFixed(2)} per 1,000 views
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
