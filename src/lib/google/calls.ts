// Phone calls from Google Ads: calls to the Google forwarding number on call ads, call assets and
// (with Google's website call snippet) the website. Google keeps each call's time, length, whether
// it was answered, and the caller's area code, never the full phone number.
import { AdsApiError, runQuery } from "@/lib/google/ads"
import type { AdsAccount, AdsConnection } from "@/lib/google/connections"
import type { Issue } from "@/lib/google/health"

export type Call = {
  start: string // "2026-09-29 14:03:11", in the account's time zone
  seconds: number
  missed: boolean
  areaCode: string
  campaign: string
  // "Ad" or "Website"
  from: string
}

type Row = Record<string, Record<string, unknown> | undefined>

const days = (n: number, now = new Date()) => {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - n)
  return `${d.toISOString().slice(0, 10)} 00:00:00`
}

// The last `sinceDays` days, or exactly the dates picked on the dashboard (`range`, YYYY-MM-DD).
type Range = { start: string; end: string }
const DAY = /^\d{4}-\d{2}-\d{2}$/
const when = (sinceDays: number, range?: Range) =>
  range && DAY.test(range.start) && DAY.test(range.end)
    ? `call_view.start_call_date_time BETWEEN '${range.start} 00:00:00' AND '${range.end} 23:59:59'`
    : `call_view.start_call_date_time >= '${days(sinceDays)}'`

export async function getCalls(connection: AdsConnection, account: AdsAccount, sinceDays = 30, range?: Range): Promise<Call[]> {
  const rows = (await runQuery(
    connection,
    account,
    `SELECT call_view.start_call_date_time, call_view.call_duration_seconds, call_view.call_status, call_view.caller_area_code, call_view.call_tracking_display_location, campaign.name FROM call_view WHERE ${when(sinceDays, range)} ORDER BY call_view.start_call_date_time DESC LIMIT 500`,
  )) as Row[]
  return rows.map((r) => ({
    start: String(r.callView?.startCallDateTime ?? ""),
    seconds: Number(r.callView?.callDurationSeconds ?? 0),
    missed: r.callView?.callStatus === "MISSED",
    areaCode: String(r.callView?.callerAreaCode ?? ""),
    campaign: String(r.campaign?.name ?? ""),
    from: r.callView?.callTrackingDisplayLocation === "LANDING_PAGE" ? "Website" : "Ad",
  }))
}

// The Leads page refreshes every few seconds; ask Google at most once a minute per account.
const cache = new Map<string, { at: number; result: { calls: Call[] } | { error: string } }>()
const FRESH_MS = 60_000

// Keeps a Google Ads problem from hiding the rest of the page.
export async function tryGetCalls(connection: AdsConnection, account: AdsAccount, sinceDays = 30, range?: Range) {
  const key = `${account.customerId}:${sinceDays}:${range ? `${range.start}:${range.end}` : ""}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.result
  let result: { calls: Call[] } | { error: string }
  try {
    result = { calls: await getCalls(connection, account, sinceDays, range) }
  } catch (error) {
    result = { error: error instanceof AdsApiError ? error.message : "Google Ads didn't return calls." }
  }
  cache.set(key, { at: Date.now(), result })
  return result
}

// Missed calls from ads, as a dashboard problem: each one may be a seller who didn't get through.
// `when` describes the calls' dates: "in the last 30 days", "from Aug 1 to Aug 31"...
export function missedCallIssue(calls: Call[], when: string): Issue | null {
  const missed = calls.filter((c) => c.missed)
  if (!missed.length) return null
  const campaigns = [...new Set(missed.map((c) => c.campaign).filter(Boolean))]
  return {
    id: "missed-calls",
    severity: missed.length >= 3 ? "high" : "medium",
    title: `${missed.length} call${missed.length === 1 ? "" : "s"} from your ads went unanswered`,
    detail: `${when.charAt(0).toUpperCase()}${when.slice(1)}, out of ${calls.length} calls${campaigns.length ? `, from ${campaigns.slice(0, 3).map((c) => `"${c}"`).join(", ")}` : ""}. The Leads page lists them with the caller's area code.`,
    fix: "Call them back from Google Ads → Campaigns → Insights and reports → Call details, forward the number to someone who can answer, and use an ad schedule so call ads only run when someone is there.",
    question: `${missed.length} of our ${calls.length} Google Ads calls ${when} were missed. How do we find those callers in Google Ads, and what should we change so fewer calls are missed?`,
  }
}
