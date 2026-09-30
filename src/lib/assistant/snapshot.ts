// The account's key numbers in one block of JSON, for when Claude Code can't use the chat's tools:
// the app looks everything up itself and hands it over with the question, so the chat still
// answers from real data. Covers the last 30 days (plus the last 7 days' totals) and recent leads.
import type { ToolContext } from "@/lib/assistant/tools"
import { getReport, getSearchTerms } from "@/lib/google/ads"
import { tryGetCalls } from "@/lib/google/calls"
import { collectIssues } from "@/lib/google/health"
import { getInsights } from "@/lib/google/insights"
import { tryGetLocations } from "@/lib/google/locations"
import { resolvePeriod } from "@/lib/google/period"
import { findWastedSearches } from "@/lib/google/wasted-searches"
import { leadSource } from "@/lib/leads/source"
import { listLeads, listQrCodes } from "@/lib/leads/store"
import { leadChannel } from "@/lib/leads/tracking"

const MAX_CHARS = 60_000
const r2 = (n: number) => Math.round(n * 100) / 100
const rows = <T>(part: { rows: T[] } | { error: string }, n: number) => ("rows" in part ? part.rows.slice(0, n) : part)

export async function buildSnapshot({ connection, account }: ToolContext) {
  const [leads, qrCodes] = await Promise.all([listLeads(), listQrCodes()])
  const placements = new Map(qrCodes.map((c) => [c.id, c.placement]))
  const since = Date.now() - 90 * 86_400_000
  const recentLeads = leads
    .filter((l) => Date.parse(l.createdAt) >= since)
    .slice(0, 100)
    .map((l) => ({
      date: l.createdAt,
      name: l.name,
      phone: l.phone,
      email: l.email,
      propertyAddress: l.propertyAddress,
      source: leadSource(l, placements),
      channel: leadChannel(l),
      tracking: l.tracking,
      notes: l.notes?.slice(0, 200),
    }))
  const leadsPart = { totalLeadsAllTime: leads.length, leadsLast90Days: recentLeads }

  if (!connection || !account) return JSON.stringify({ googleAds: "Google Ads isn't connected.", ...leadsPart })

  const period = resolvePeriod({ range: "30" })
  const week = resolvePeriod({ range: "7" })
  const [report, weekReport, terms, locations, calls, insights] = await Promise.all([
    getReport(connection, account, period),
    getReport(connection, account, week).catch(() => null),
    getSearchTerms(connection, account, period).catch(() => []),
    tryGetLocations(connection, account, period),
    tryGetCalls(connection, account, 30),
    getInsights(connection, account, period),
  ])
  const { totals } = report
  const costPerConversion = totals.conversions ? totals.cost / totals.conversions : 0
  const wasted = findWastedSearches(terms, costPerConversion)
  const issues = await collectIssues(connection, account, report, period, { wasted, costPerConversion, locations, calls, callDays: 30 })

  const snapshot = {
    account: { name: account.name, currency: account.currency },
    period: { start: report.start, end: report.end },
    last30Days: { spend: r2(totals.cost), impressions: totals.impressions, clicks: totals.clicks, conversions: r2(totals.conversions) },
    last7Days: weekReport
      ? { spend: r2(weekReport.totals.cost), clicks: weekReport.totals.clicks, conversions: r2(weekReport.totals.conversions) }
      : null,
    problemsFound: issues.map((i) => ({ severity: i.severity, title: i.title, detail: i.detail, fix: i.fix })),
    campaigns: report.campaigns.slice(0, 30).map((c) => ({
      name: c.name,
      status: c.status,
      type: c.channel,
      spend: r2(c.cost),
      clicks: c.clicks,
      impressions: c.impressions,
      conversions: r2(c.conversions),
    })),
    impressionShare: rows(insights.share, 30),
    searchesToRemove: wasted.wasted.slice(0, 40).map((w) => ({ term: w.term, why: w.reason, cost: r2(w.cost), clicks: w.clicks, blockWith: w.negative })),
    topSearchTerms: terms.slice(0, 40).map((t) => ({ term: t.term, cost: r2(t.cost), clicks: t.clicks, conversions: r2(t.conversions) })),
    keywords: rows(insights.keywords, 60),
    ads: rows(insights.ads, 25),
    devices: rows(insights.devices, 10),
    conversionTracking: rows(insights.conversions, 20),
    locations: "error" in locations ? locations : { targets: locations.targets, places: locations.places.slice(0, 30) },
    calls: "calls" in calls ? { total: calls.calls.length, missed: calls.calls.filter((c) => c.missed).length, recent: calls.calls.slice(0, 30) } : calls,
    ...leadsPart,
  }
  const text = JSON.stringify(snapshot)
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}… (cut short)` : text
}
