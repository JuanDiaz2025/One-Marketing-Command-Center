// The dashboard's extra tabs: keywords, ads, devices, days and hours, conversion tracking, and each
// campaign's impression share. Each part loads on its own, so one Google Ads error only hides
// that tab's table.
import { AdsApiError, runQuery, type Metrics } from "@/lib/google/ads"
import type { AdsAccount, AdsConnection } from "@/lib/google/connections"
import type { Period } from "@/lib/google/period"

type Row = Record<string, Record<string, unknown> | undefined>
type Part<T> = { rows: T[] } | { error: string }

const num = (v: unknown) => Number(v ?? 0)
const metrics = (m: Record<string, unknown> = {}): Metrics => ({
  cost: num(m.costMicros) / 1_000_000,
  impressions: num(m.impressions),
  clicks: num(m.clicks),
  conversions: num(m.conversions),
  conversionValue: num(m.conversionsValue),
})
const METRICS = "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value"
const get = <T>(row: Row, path: string) =>
  path.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], row) as T | undefined

export type Keyword = Metrics & {
  text: string
  matchType: string
  qualityScore: number | null
  campaign: string
  adGroup: string
  status: string
}

export type Ad = Metrics & {
  id: string
  headlines: string[]
  finalUrl: string
  campaign: string
  adGroup: string
  status: string
  approval: string
  strength: string
}

export type DeviceRow = Metrics & { device: string }
export type TimeRow = Metrics & { day: string; hour: number }

export type ConversionAction = {
  name: string
  status: string
  category: string
  primary: boolean
  conversions: number
}

export type CampaignShare = {
  campaign: string
  impressionShare: number | null
  lostToBudget: number | null
  lostToRank: number | null
}

export type Insights = {
  keywords: Part<Keyword>
  ads: Part<Ad>
  devices: Part<DeviceRow>
  times: Part<TimeRow>
  conversions: Part<ConversionAction>
  share: Part<CampaignShare>
}

async function part<T>(load: () => Promise<T[]>): Promise<Part<T>> {
  try {
    return { rows: await load() }
  } catch (error) {
    return { error: error instanceof AdsApiError ? error.message : "Google Ads didn't return this report." }
  }
}

// Google reports impression share as a fraction; below 10% it says "< 10%" as 0.0999.
const share = (v: unknown) => (v === undefined || v === null || v === "" ? null : num(v))

export async function getInsights(connection: AdsConnection, account: AdsAccount, { start, end }: Period): Promise<Insights> {
  const during = `segments.date BETWEEN '${start}' AND '${end}'`
  const q = (query: string) => runQuery(connection, account, query) as Promise<Row[]>

  const [keywords, ads, devices, times, conversions, shareRows] = await Promise.all([
    part(async () =>
      (
        await q(
          `SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.quality_info.quality_score, ad_group_criterion.status, campaign.name, ad_group.name, ${METRICS} FROM keyword_view WHERE ${during} AND ad_group_criterion.status != 'REMOVED' AND metrics.impressions > 0 ORDER BY metrics.cost_micros DESC LIMIT 300`,
        )
      ).map((r) => ({
        text: get<string>(r, "adGroupCriterion.keyword.text") ?? "",
        matchType: get<string>(r, "adGroupCriterion.keyword.matchType") ?? "",
        qualityScore: get<number>(r, "adGroupCriterion.qualityInfo.qualityScore") ?? null,
        status: get<string>(r, "adGroupCriterion.status") ?? "",
        campaign: get<string>(r, "campaign.name") ?? "",
        adGroup: get<string>(r, "adGroup.name") ?? "",
        ...metrics(r.metrics),
      })),
    ),
    part(async () =>
      (
        await q(
          `SELECT ad_group_ad.ad.id, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.final_urls, ad_group_ad.status, ad_group_ad.policy_summary.approval_status, ad_group_ad.ad_strength, campaign.name, ad_group.name, ${METRICS} FROM ad_group_ad WHERE ${during} AND ad_group_ad.status != 'REMOVED' AND campaign.status != 'REMOVED' ORDER BY metrics.impressions DESC LIMIT 100`,
        )
      ).map((r) => ({
        id: String(get(r, "adGroupAd.ad.id") ?? ""),
        headlines: (get<{ text?: string }[]>(r, "adGroupAd.ad.responsiveSearchAd.headlines") ?? [])
          .map((h) => h.text ?? "")
          .filter(Boolean),
        finalUrl: (get<string[]>(r, "adGroupAd.ad.finalUrls") ?? [])[0] ?? "",
        status: get<string>(r, "adGroupAd.status") ?? "",
        approval: get<string>(r, "adGroupAd.policySummary.approvalStatus") ?? "",
        strength: get<string>(r, "adGroupAd.adStrength") ?? "",
        campaign: get<string>(r, "campaign.name") ?? "",
        adGroup: get<string>(r, "adGroup.name") ?? "",
        ...metrics(r.metrics),
      })),
    ),
    part(async () =>
      (await q(`SELECT segments.device, ${METRICS} FROM customer WHERE ${during}`))
        .filter((r) => get(r, "segments.device"))
        .map((r) => ({ device: get<string>(r, "segments.device") ?? "", ...metrics(r.metrics) })),
    ),
    part(async () =>
      (await q(`SELECT segments.day_of_week, segments.hour, ${METRICS} FROM customer WHERE ${during}`))
        .filter((r) => get(r, "segments.dayOfWeek"))
        .map((r) => ({
          day: get<string>(r, "segments.dayOfWeek") ?? "",
          hour: num(get(r, "segments.hour")),
          ...metrics(r.metrics),
        })),
    ),
    part(async () => {
      const [actions, counts] = await Promise.all([
        q(
          "SELECT conversion_action.name, conversion_action.status, conversion_action.category, conversion_action.primary_for_goal FROM conversion_action WHERE conversion_action.status != 'REMOVED'",
        ),
        q(`SELECT segments.conversion_action_name, metrics.all_conversions FROM customer WHERE ${during}`).catch(() => [] as Row[]),
      ])
      const byName = new Map<string, number>()
      for (const r of counts) {
        const name = get<string>(r, "segments.conversionActionName")
        if (name) byName.set(name, (byName.get(name) ?? 0) + num(get(r, "metrics.allConversions")))
      }
      return actions.map((r) => {
        const name = get<string>(r, "conversionAction.name") ?? ""
        return {
          name,
          status: get<string>(r, "conversionAction.status") ?? "",
          category: get<string>(r, "conversionAction.category") ?? "",
          primary: get<boolean>(r, "conversionAction.primaryForGoal") !== false,
          conversions: byName.get(name) ?? 0,
        }
      })
    }),
    part(async () =>
      (
        await q(
          `SELECT campaign.name, metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share FROM campaign WHERE ${during} AND campaign.status = 'ENABLED' AND campaign.advertising_channel_type = 'SEARCH'`,
        )
      ).map((r) => ({
        campaign: get<string>(r, "campaign.name") ?? "",
        impressionShare: share(get(r, "metrics.searchImpressionShare")),
        lostToBudget: share(get(r, "metrics.searchBudgetLostImpressionShare")),
        lostToRank: share(get(r, "metrics.searchRankLostImpressionShare")),
      })),
    ),
  ])

  return { keywords, ads, devices, times, conversions, share: shareRows }
}
