// Campaign performance for the dashboard. It follows the campaign launched in setup: its
// platforms, placements, ads, and budget. Delivery (spend, impressions, clicks) is mocked from the
// budget; conversions and revenue are counted from the QR conversion feed, so a new in-store
// conversion shows up here too. Swap `getDashboardData` for real platform reporting later.
import {
  byAd,
  byPlacement,
  customers,
  inPeriod,
  perDay,
  platformOf,
  summarize,
} from "@/lib/conversions/insights"
import type { Conversion } from "@/lib/conversions/types"
import { CAMPAIGN_PERIOD, demoCampaign, type CampaignPlacement } from "@/lib/demo-campaign"
import type { ChannelFormat, Platform } from "@/lib/setup"

// Typical cost per 1,000 impressions and click rate for each ad format.
const formatRates: Record<ChannelFormat, { cpm: number; ctr: number }> = {
  vertical: { cpm: 6.5, ctr: 0.009 },
  feed: { cpm: 8, ctr: 0.011 },
  search: { cpm: 38, ctr: 0.062 },
  map: { cpm: 14, ctr: 0.034 },
}

export type Totals = {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  revenue: number
}

export type PlacementPerformance = CampaignPlacement & Totals

export type PlatformPerformance = {
  id: Platform
  name: string
  detail: string
  budgetShare: number
  placements: PlacementPerformance[]
  totals: Totals
  daily: { date: string; value: number }[]
}

export type Priority = "High" | "Medium" | "Low"

export type CrmAction = {
  priority: Priority
  channel: string
  segment: string
  action: string
  reason: string
}

export type DashboardData = ReturnType<typeof getDashboardData>

export function sumTotals(list: Totals[]): Totals {
  return list.reduce<Totals>(
    (t, c) => ({
      spend: t.spend + c.spend,
      impressions: t.impressions + c.impressions,
      clicks: t.clicks + c.clicks,
      conversions: t.conversions + c.conversions,
      revenue: t.revenue + c.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  )
}

export const clickThroughRate = (t: Totals) => (t.impressions ? t.clicks / t.impressions : 0)
export const costPerConversion = (t: Totals) => (t.conversions ? t.spend / t.conversions : 0)
export const returnOnAdSpend = (t: Totals) => (t.spend ? t.revenue / t.spend : 0)

const daysBetween = (start: string, end: string) =>
  Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1

export function getDashboardData(allConversions: Conversion[]) {
  // Run the period through the latest conversion, so ones made during a demo count too.
  const latest = allConversions.at(-1)?.createdAt.slice(0, 10) ?? CAMPAIGN_PERIOD.end
  const period = {
    start: CAMPAIGN_PERIOD.start,
    end: latest > CAMPAIGN_PERIOD.end ? latest : CAMPAIGN_PERIOD.end,
  }
  const conversions = inPeriod(allConversions, period.start, period.end)
  const matched = conversions.filter((c) => c.attribution)
  const days = daysBetween(period.start, period.end)
  const spent = Math.min(demoCampaign.monthlyBudget, (demoCampaign.monthlyBudget * days) / 30)

  const tallies = byPlacement(matched)
  const placements: PlacementPerformance[] = demoCampaign.placements.map((p) => {
    const spend = (spent * p.budgetShare) / 100
    const impressions = Math.round((spend / formatRates[p.format].cpm) * 1000)
    const tally = tallies.get(p.id)!
    return {
      ...p,
      spend,
      impressions,
      clicks: Math.round(impressions * formatRates[p.format].ctr),
      conversions: tally.count,
      revenue: tally.revenue,
    }
  })

  const platforms: PlatformPerformance[] = demoCampaign.platforms.map((platform) => {
    const own = placements.filter((p) => p.platform === platform.value)
    return {
      id: platform.value,
      name: platform.label,
      detail: platform.detail,
      budgetShare: platform.share,
      placements: own,
      totals: sumTotals(own),
      daily: perDay(
        matched.filter((c) => platformOf(c) === platform.value),
        period.start,
        period.end,
      ),
    }
  })

  // The A/B test: ad views split across the placements that show creatives, leaning toward the
  // ads that convert, the way the platforms rebalance delivery.
  const adTallies = byAd(matched)
  const creativeImpressions = placements
    .filter((p) => p.format === "vertical" || p.format === "feed")
    .reduce((sum, p) => sum + p.impressions, 0)
  const adConversions = [...adTallies.values()].reduce((sum, t) => sum + t.count, 0)
  const adImpressions = new Map(
    demoCampaign.ads.map((ad) => {
      const count = adTallies.get(ad.id)?.count ?? 0
      const share = (count + 8) / (adConversions + 8 * demoCampaign.ads.length)
      return [ad.id, Math.round(creativeImpressions * share)]
    }),
  )

  return {
    period,
    spent,
    platforms,
    placements,
    totals: sumTotals(placements),
    conversions,
    matched,
    summary: summarize(conversions),
    customers: customers(conversions),
    adImpressions,
  }
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const usd = (n: number) => `$${n.toFixed(n < 10 ? 2 : 0)}`

// Recommended next steps, built from the numbers so they stay true when the data changes.
export function recommendedActions(data: DashboardData): CrmAction[] {
  const active = data.placements.filter((p) => p.conversions > 0)
  const byCost = [...active].sort((a, b) => costPerConversion(a) - costPerConversion(b))
  const best = byCost[0]
  const worst = byCost.at(-1)
  const average = costPerConversion(data.totals)
  const newCustomers = data.customers.filter((c) => c.visits === 1)
  const returning = data.customers.filter((c) => c.visits > 1)
  const unmatchedShare = 1 - data.summary.matchedShare
  const actions: CrmAction[] = []

  if (best) {
    actions.push({
      priority: "High",
      channel: best.name,
      segment: `${best.formatLabel} on ${best.platform === "meta" ? "Meta" : "Google"}`,
      action: `Auto mode is moving more of your budget to ${best.name}.`,
      reason: `${best.name} brings customers in at ${usd(costPerConversion(best))} each, vs ${usd(average)} across the campaign.`,
    })
  }
  if (worst && best && worst.id !== best.id) {
    actions.push({
      priority: "Medium",
      channel: worst.name,
      segment: `${worst.formatLabel} · ${usd(worst.spend)} spent`,
      action: `Test a new ad on ${worst.name}, or let auto mode scale it back.`,
      reason: `${worst.name} costs ${usd(costPerConversion(worst))} per conversion, the most of any placement.`,
    })
  }
  actions.push({
    priority: "High",
    channel: "QR code customers",
    segment: `First-time customers who haven't come back (${newCustomers.length})`,
    action: "Send a thank-you with a second-visit offer to their email or phone.",
    reason: `${pct(returning.length / Math.max(data.customers.length, 1))} of QR customers have already come back. A second visit is the cheapest one you'll get.`,
  })
  if (unmatchedShare > 0.05) {
    actions.push({
      priority: "Low",
      channel: "In-store",
      segment: `Walk-ins not matched to an ad (${pct(unmatchedShare)})`,
      action: "Ask every customer to scan the QR code at the counter, not just new ones.",
      reason:
        "Every matched conversion is fed back to Meta and Google, so they learn faster who to show your ads to.",
    })
  }
  return actions
}
