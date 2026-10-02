// Where the ads are aimed (each campaign's location targets) and where the clicks actually came
// from (the searcher's physical location), plus the location problems worth fixing.
import { AdsApiError, addMetrics, emptyMetrics, runQuery, type AdsReport, type Metrics } from "@/lib/google/ads"
import type { AdsAccount, AdsConnection } from "@/lib/google/connections"
import type { Issue } from "@/lib/google/health"
import { describePeriod, type Period } from "@/lib/google/period"

export type Place = Metrics & {
  name: string
  // False when the click came from outside every location the campaign targets.
  inTarget: boolean
}

export type CampaignTargets = {
  campaign: string
  included: string[]
  excluded: string[]
  // PRESENCE (people in the area) or PRESENCE_OR_INTEREST (also people elsewhere searching about it).
  option: string
}

export type LocationReport = { places: Place[]; targets: CampaignTargets[] }

type Row = Record<string, Record<string, unknown> | undefined>
const get = <T>(row: Row, path: string) =>
  path.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], row) as T | undefined

const num = (v: unknown) => Number(v ?? 0)
const toMetrics = (m: Record<string, unknown> = {}): Metrics => ({
  cost: num(m.costMicros) / 1_000_000,
  impressions: num(m.impressions),
  clicks: num(m.clicks),
  conversions: num(m.conversions),
  conversionValue: num(m.conversionsValue),
})

// "Tampa,Florida,United States" → "Tampa, Florida"; countries stay as they are.
function placeName(canonical: string | undefined, fallback: string) {
  if (!canonical) return fallback
  const parts = canonical.split(",")
  return (parts.length > 1 ? parts.slice(0, -1) : parts).join(", ")
}

// Location ids arrive as "geoTargetConstants/1015116"; Google has the names.
async function placeNames(connection: AdsConnection, account: AdsAccount, ids: string[]) {
  const names = new Map<string, string>()
  const unique = [...new Set(ids)].filter((id) => /^geoTargetConstants\/\d+$/.test(id))
  for (let i = 0; i < unique.length; i += 200) {
    const list = unique.slice(i, i + 200).map((id) => `'${id}'`).join(", ")
    const rows = (await runQuery(
      connection,
      account,
      `SELECT geo_target_constant.resource_name, geo_target_constant.name, geo_target_constant.canonical_name FROM geo_target_constant WHERE geo_target_constant.resource_name IN (${list})`,
    )) as Row[]
    for (const r of rows) {
      const id = get<string>(r, "geoTargetConstant.resourceName")
      if (id) names.set(id, placeName(get(r, "geoTargetConstant.canonicalName"), get(r, "geoTargetConstant.name") ?? id))
    }
  }
  return names
}

const miles = (radius: unknown, units: unknown) =>
  `${num(radius)} ${units === "KILOMETERS" ? "km" : "mi"}`

export async function getLocations(
  connection: AdsConnection,
  account: AdsAccount,
  { start, end }: Period,
): Promise<LocationReport> {
  const [placeRows, criteriaRows, settingRows] = (await Promise.all([
    runQuery(
      connection,
      account,
      `SELECT segments.geo_target_city, segments.geo_target_region, user_location_view.country_criterion_id, user_location_view.targeting_location, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM user_location_view WHERE segments.date BETWEEN '${start}' AND '${end}' AND metrics.impressions > 0`,
    ),
    runQuery(
      connection,
      account,
      "SELECT campaign.name, campaign_criterion.type, campaign_criterion.negative, campaign_criterion.location.geo_target_constant, campaign_criterion.proximity.radius, campaign_criterion.proximity.radius_units, campaign_criterion.proximity.address.city_name, campaign_criterion.proximity.address.postal_code FROM campaign_criterion WHERE campaign_criterion.type IN ('LOCATION', 'PROXIMITY') AND campaign_criterion.status != 'REMOVED' AND campaign.status = 'ENABLED'",
    ),
    runQuery(
      connection,
      account,
      "SELECT campaign.name, campaign.advertising_channel_type, campaign.geo_target_type_setting.positive_geo_target_type FROM campaign WHERE campaign.status = 'ENABLED'",
    ),
  ])) as Row[][]

  const names = await placeNames(connection, account, [
    ...placeRows.flatMap((r) => [get<string>(r, "segments.geoTargetCity"), get<string>(r, "segments.geoTargetRegion")]),
    ...placeRows.map((r) => {
      const country = get<string | number>(r, "userLocationView.countryCriterionId")
      return country ? `geoTargetConstants/${country}` : undefined
    }),
    ...criteriaRows.map((r) => get<string>(r, "campaignCriterion.location.geoTargetConstant")),
  ].filter((id): id is string => Boolean(id)))

  // The same city shows once per campaign; add them up.
  const byPlace = new Map<string, Place>()
  for (const r of placeRows) {
    const country = get<string | number>(r, "userLocationView.countryCriterionId")
    const id =
      get<string>(r, "segments.geoTargetCity") ??
      get<string>(r, "segments.geoTargetRegion") ??
      (country ? `geoTargetConstants/${country}` : "unknown")
    const inTarget = get<boolean>(r, "userLocationView.targetingLocation") === true
    const key = `${id}|${inTarget}`
    const current = byPlace.get(key) ?? { name: names.get(id) ?? "Unknown location", inTarget, ...emptyMetrics() }
    byPlace.set(key, { ...current, ...addMetrics(current, toMetrics(r.metrics)) })
  }
  const places = [...byPlace.values()].sort((a, b) => b.cost - a.cost || b.clicks - a.clicks)

  const targets = new Map<string, CampaignTargets>()
  for (const r of settingRows) {
    const campaign = get<string>(r, "campaign.name") ?? ""
    // Video and app campaigns set locations elsewhere; skip them.
    if (["VIDEO", "MULTI_CHANNEL"].includes(get<string>(r, "campaign.advertisingChannelType") ?? "")) continue
    targets.set(campaign, {
      campaign,
      included: [],
      excluded: [],
      option: get<string>(r, "campaign.geoTargetTypeSetting.positiveGeoTargetType") ?? "PRESENCE_OR_INTEREST",
    })
  }
  for (const r of criteriaRows) {
    const t = targets.get(get<string>(r, "campaign.name") ?? "")
    if (!t) continue
    const geo = get<string>(r, "campaignCriterion.location.geoTargetConstant")
    const label = geo
      ? (names.get(geo) ?? geo)
      : `${miles(get(r, "campaignCriterion.proximity.radius"), get(r, "campaignCriterion.proximity.radiusUnits"))} around ${
          get<string>(r, "campaignCriterion.proximity.address.cityName") ??
          get<string>(r, "campaignCriterion.proximity.address.postalCode") ??
          "a pin"
        }`
    ;(get<boolean>(r, "campaignCriterion.negative") ? t.excluded : t.included).push(label)
  }

  return { places, targets: [...targets.values()].sort((a, b) => a.campaign.localeCompare(b.campaign)) }
}

// Wraps getLocations so a failure only hides the Locations section, not the whole dashboard.
export async function tryGetLocations(connection: AdsConnection, account: AdsAccount, period: Period) {
  try {
    return await getLocations(connection, account, period)
  } catch (error) {
    return { error: error instanceof AdsApiError ? error.message : "Google Ads didn't return locations." }
  }
}

const list = (names: string[], max = 3) =>
  names.length <= max
    ? names.map((n) => `"${n}"`).join(", ")
    : `${names.slice(0, max).map((n) => `"${n}"`).join(", ")} and ${names.length - max} more`

export function locationIssues(
  { places, targets }: LocationReport,
  report: AdsReport,
  currency: string,
  period: Period,
): Issue[] {
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n)
  const when = describePeriod(period)
  const spent = new Set(report.campaigns.filter((c) => c.cost > 0).map((c) => c.name))
  const issues: Issue[] = []

  const everywhere = targets.filter((t) => !t.included.length && spent.has(t.campaign))
  if (everywhere.length) {
    issues.push({
      id: "no-location-targets",
      severity: "high",
      title: `${everywhere.length === 1 ? "A campaign has" : `${everywhere.length} campaigns have`} no location set, so ads can show anywhere`,
      detail: `${list(everywhere.map((t) => t.campaign))} ${everywhere.length === 1 ? "isn't" : "aren't"} limited to the areas you buy houses in.`,
      fix: "In Google Ads open the campaign → Settings → Locations, choose Enter another location, add the cities, counties or ZIP codes you buy in, and save.",
      question: `These Google Ads campaigns have no location targeting: ${list(everywhere.map((t) => t.campaign), 10)}. How do we set them to only show in the areas we buy houses, step by step?`,
    })
  }

  const interest = targets.filter((t) => t.option === "PRESENCE_OR_INTEREST" && t.included.length)
  if (interest.length) {
    issues.push({
      id: "presence-or-interest",
      severity: "medium",
      title: `${interest.length === 1 ? "A campaign shows" : `${interest.length} campaigns show`} ads to people outside your area`,
      detail: `${list(interest.map((t) => t.campaign))} use Google's default "Presence or interest", which also shows ads to people anywhere who search about your area (buyers and renters moving there, not local sellers).`,
      fix: 'In Google Ads open the campaign → Settings → Locations → Location options, pick "Presence: People in or regularly in your included locations", and save.',
      question: `Our campaigns ${list(interest.map((t) => t.campaign), 10)} target "Presence or interest". Should a cash home buyer switch to "Presence" only, and how?`,
    })
  }

  const outside = places.filter((p) => !p.inTarget && p.cost > 0)
  const outsideCost = outside.reduce((sum, p) => sum + p.cost, 0)
  if (outsideCost >= Math.max(10, report.totals.cost * 0.05)) {
    issues.push({
      id: "outside-target-area",
      severity: outsideCost >= Math.max(50, report.totals.cost * 0.15) ? "high" : "medium",
      title: `${money(outsideCost)} spent on clicks from outside your target area`,
      detail: `${cap(when)}, people outside the locations you target clicked your ads: ${list(outside.map((p) => `${p.name} (${money(p.cost)})`))}.`,
      fix: 'Switch each campaign\'s Location options to "Presence", and add the worst places under Settings → Locations → Excluded.',
      question: `${cap(when)} we spent ${money(outsideCost)} on clicks from outside our target area: ${list(outside.map((p) => `${p.name} (${money(p.cost)}, ${p.conversions} conversions)`), 15)}. What should we change so this stops?`,
    })
  }

  const costPerLead = report.totals.conversions ? report.totals.cost / report.totals.conversions : 0
  const limit = Math.max(25, costPerLead)
  const dry = places.filter((p) => p.inTarget && p.conversions < 0.5 && p.cost >= limit)
  if (dry.length) {
    const total = dry.reduce((sum, p) => sum + p.cost, 0)
    issues.push({
      id: "cities-without-leads",
      severity: "medium",
      title: `${dry.length} ${dry.length === 1 ? "place" : "places"} spent ${money(total)} with no leads`,
      detail: `${list(dry.map((p) => `${p.name} (${money(p.cost)})`))} each cost more than a lead usually does (${money(limit)}) without bringing one in.`,
      fix: "In Google Ads open Campaigns → Locations, find these places, and lower their bid adjustment (for example −30%), or exclude them if you don't buy there.",
      question: `${cap(when)} these places in our target area spent money with no leads: ${list(dry.map((p) => `${p.name} (${money(p.cost)}, ${p.clicks} clicks)`), 15)}. Should we lower bids there or exclude them?`,
    })
  }

  return issues
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
