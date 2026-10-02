// The ad health check: problems in the Google Ads account worth fixing, found with read-only
// queries plus the numbers already loaded for the dashboard. Each check runs on its own, so one
// failing (e.g. a field Google changed) doesn't hide the others.
import { runQuery, type AdsReport } from "@/lib/google/ads"
import { missedCallIssue, type Call } from "@/lib/google/calls"
import type { AdsAccount, AdsConnection } from "@/lib/google/connections"
import { locationIssues, type LocationReport } from "@/lib/google/locations"
import { describePeriod, type Period } from "@/lib/google/period"
import type { WastedSummary } from "@/lib/google/wasted-searches"

export type Issue = {
  id: string
  severity: "high" | "medium"
  title: string
  detail: string
  // Plain steps in Google Ads, shown even when the assistant isn't set up.
  fix: string
  // What the "Ask how to fix" button sends to the assistant.
  question: string
}

const humanize = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ")

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const list = (names: string[], max = 3) =>
  names.length <= max
    ? names.map((n) => `"${n}"`).join(", ")
    : `${names.slice(0, max).map((n) => `"${n}"`).join(", ")} and ${names.length - max} more`

// Wasted searches as an alert, so they show with the other problems instead of only in their list.
export function wastedSearchIssue(
  { wasted, total }: WastedSummary,
  currency: string,
  costPerConversion: number,
  period: Period,
): Issue | null {
  if (!wasted.length) return null
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n)
  const fresh = wasted.filter((w) => w.isNew).length
  return {
    id: "wasted-searches",
    // A lead's worth of money (or $50) thrown away is worth acting on today.
    severity: total >= Math.max(50, costPerConversion) ? "high" : "medium",
    title: `${wasted.length} search${wasted.length === 1 ? "" : "es"} wasted ${money(total)} with no leads${fresh ? ` (${fresh} new)` : ""}`,
    detail: `Top offenders: ${list(wasted.map((w) => `${w.term} (${money(w.cost)})`))}.`,
    fix: 'Open the "Searches to remove" tab, click Copy negative keywords, then in Google Ads open Keywords → Negative keywords → +, paste, and save.',
    question: `${cap(describePeriod(period))} these searches cost money but brought no leads: ${list(wasted.map((w) => `${w.term} (${money(w.cost)}, ${w.reason.toLowerCase()})`), 15)}. Which should we block, as phrase or exact match negatives, and are any worth keeping?`,
  }
}

type Row = Record<string, Record<string, unknown> | undefined>

async function tryQuery(connection: AdsConnection, account: AdsAccount, query: string) {
  try {
    return (await runQuery(connection, account, query)) as Row[]
  } catch (error) {
    console.error("Health check query failed:", error instanceof Error ? error.message : error)
    return null
  }
}

export async function getHealthIssues(
  connection: AdsConnection,
  account: AdsAccount,
  report: AdsReport,
  period: Period,
): Promise<Issue[]> {
  const { start, end } = period
  const when = describePeriod(period)
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: account.currency }).format(n)
  const issues: Issue[] = []

  const [statusRows, adRows, keywordRows] = await Promise.all([
    tryQuery(
      connection,
      account,
      "SELECT campaign.id, campaign.name, campaign.primary_status, campaign.primary_status_reasons FROM campaign WHERE campaign.status = 'ENABLED'",
    ),
    tryQuery(
      connection,
      account,
      "SELECT campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.policy_topic_entries FROM ad_group_ad WHERE ad_group_ad.status = 'ENABLED' AND campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND ad_group_ad.policy_summary.approval_status IN ('DISAPPROVED', 'APPROVED_LIMITED') LIMIT 100",
    ),
    tryQuery(
      connection,
      account,
      `SELECT ad_group_criterion.keyword.text, ad_group_criterion.quality_info.quality_score, campaign.name, metrics.cost_micros FROM keyword_view WHERE segments.date BETWEEN '${start}' AND '${end}' AND ad_group_criterion.status = 'ENABLED' AND metrics.cost_micros > 0 ORDER BY metrics.cost_micros DESC LIMIT 200`,
    ),
  ])

  // Google didn't answer the checks: say so, rather than "No problems found".
  if (!statusRows && !adRows && !keywordRows) {
    issues.push({
      id: "checks-failed",
      severity: "medium",
      title: "Couldn't check your campaigns, ads and keywords",
      detail: "Google Ads didn't answer the checks this time, so problems may be hidden.",
      fix: "Refresh the page in a few minutes. If it stays, connect Google Ads again on this page.",
      question: "The Google Ads health checks couldn't run (Google didn't answer). What could cause that?",
    })
  }

  // Ads Google won't show, or shows less.
  if (adRows?.length) {
    const disapproved = adRows.filter((r) => r.adGroupAd?.policySummary && (r.adGroupAd.policySummary as { approvalStatus?: string }).approvalStatus === "DISAPPROVED")
    const limited = adRows.length - disapproved.length
    const topics = [
      ...new Set(
        adRows.flatMap((r) =>
          (((r.adGroupAd?.policySummary as { policyTopicEntries?: { topic?: string }[] })?.policyTopicEntries) ?? [])
            .map((e) => e.topic)
            .filter((t): t is string => Boolean(t))
            .map(humanize),
        ),
      ),
    ]
    issues.push({
      id: "disapproved-ads",
      severity: disapproved.length ? "high" : "medium",
      title: disapproved.length
        ? `${disapproved.length} ad${disapproved.length === 1 ? " is" : "s are"} disapproved`
        : `${limited} ad${limited === 1 ? " is" : "s are"} limited by Google's policies`,
      detail: `${disapproved.length ? "Disapproved ads don't run at all." : "Limited ads show less often."}${topics.length ? ` Google's reason: ${topics.slice(0, 3).join(", ")}.` : ""}`,
      fix: "In Google Ads, open Campaigns → Ads, set the Status column filter to Disapproved or Limited, hover the status to read the policy, then edit the ad or appeal.",
      question: `Some of our Google Ads have policy problems: ${[
        disapproved.length && `${disapproved.length} disapproved`,
        limited && `${limited} limited`,
      ]
        .filter(Boolean)
        .join(" and ")}${topics.length ? ` (${topics.slice(0, 3).join(", ")})` : ""}. Which ads are they, why, and exactly how do we fix them?`,
    })
  }

  // Campaigns Google says can't run fully.
  if (statusRows) {
    const troubled = statusRows
      .map((r) => r.campaign as { name?: string; primaryStatus?: string; primaryStatusReasons?: string[] } | undefined)
      .filter((c): c is { name: string; primaryStatus?: string; primaryStatusReasons?: string[] } => Boolean(c?.name))
    const budget = troubled.filter((c) => c.primaryStatusReasons?.includes("BUDGET_CONSTRAINED"))
    if (budget.length) {
      issues.push({
        id: "budget-limited",
        severity: "medium",
        title: `${budget.length} campaign${budget.length === 1 ? " is" : "s are"} limited by budget`,
        detail: `${list(budget.map((c) => c.name))} ran out of daily budget, so ads stopped showing part of the day.`,
        fix: "If these campaigns bring leads at a good cost, raise their daily budget in Campaigns → Budget. If not, lower bids or narrow targeting instead.",
        question: `${list(budget.map((c) => c.name))} ${budget.length === 1 ? "is" : "are"} limited by budget. Are they worth more budget based on cost per conversion, and what should we change?`,
      })
    }
    const broken = troubled.filter(
      (c) => c.primaryStatus === "NOT_ELIGIBLE" || c.primaryStatus === "MISCONFIGURED",
    )
    if (broken.length) {
      const reasons = [...new Set(broken.flatMap((c) => c.primaryStatusReasons ?? []))].map(humanize)
      issues.push({
        id: "not-eligible",
        severity: "high",
        title: `${broken.length} active campaign${broken.length === 1 ? " can't" : "s can't"} run`,
        detail: `${list(broken.map((c) => c.name))}${reasons.length ? `: ${reasons.slice(0, 3).join(", ")}` : ""}.`,
        fix: "Open the campaign in Google Ads and hover its Status to see what's blocking it (billing, ended dates, missing ads or keywords).",
        question: `These campaigns are enabled but not eligible to run: ${list(broken.map((c) => c.name), 10)}${reasons.length ? ` (${reasons.join(", ")})` : ""}. What's wrong and how do we fix it?`,
      })
    }

    // Turned on but nobody saw them.
    const withImpressions = new Set(report.campaigns.filter((c) => c.impressions > 0).map((c) => c.id))
    const silent = statusRows
      .map((r) => r.campaign as { id?: string; name?: string; primaryStatus?: string } | undefined)
      .filter((c) => c?.id && c.name && !withImpressions.has(String(c.id)) && !["NOT_ELIGIBLE", "MISCONFIGURED", "ENDED", "PENDING", "PAUSED", "REMOVED"].includes(c.primaryStatus ?? ""))
      .map((c) => c!.name!)
    if (silent.length) {
      issues.push({
        id: "no-impressions",
        severity: "medium",
        title: `${silent.length} active campaign${silent.length === 1 ? " got" : "s got"} no impressions`,
        detail: `${list(silent)} ${silent.length === 1 ? "is turned on but wasn't" : "are turned on but weren't"} shown to anyone in this period.`,
        fix: "Check that each has enabled ads and keywords, a budget, bids high enough to compete, and a location that isn't too small.",
        question: `These campaigns are enabled but got zero impressions ${when}: ${list(silent, 10)}. Why might that be and what should we check?`,
      })
    }
  }

  // Money in, nothing out.
  const { totals } = report
  if (totals.clicks >= 30 && totals.conversions < 0.5) {
    issues.push({
      id: "no-conversions",
      severity: "high",
      title: "Clicks but no conversions: tracking may be broken",
      detail: `${totals.clicks} clicks and ${money(totals.cost)} spent with zero conversions recorded. Either conversion tracking isn't working or the ads send people to a page that doesn't convert.`,
      fix: "In Google Ads open Goals → Conversions → Summary and check each action's Status. Submit your own website form once and see if it's counted within a few hours.",
      question: `We had ${totals.clicks} clicks and ${money(totals.cost)} in spend ${when} but zero conversions. Is conversion tracking broken? Walk me through checking it step by step.`,
    })
  } else {
    const cpa = totals.conversions ? totals.cost / totals.conversions : 0
    const limit = Math.max(50, cpa * 2)
    const wasting = report.campaigns.filter((c) => c.conversions < 0.5 && c.cost >= limit)
    if (wasting.length) {
      const spent = wasting.reduce((sum, c) => sum + c.cost, 0)
      issues.push({
        id: "wasting-campaigns",
        severity: "high",
        title: `${wasting.length} campaign${wasting.length === 1 ? "" : "s"} spent ${money(spent)} with no conversions`,
        detail: `${list(wasting.map((c) => c.name))}${cpa ? `, while a conversion usually costs ${money(cpa)}` : ""}.`,
        fix: "Look at its search terms and keywords, pause what's irrelevant, and check the landing page works. If nothing improves in a week or two, pause the campaign.",
        question: `${list(wasting.map((c) => c.name), 10)} spent ${money(spent)} ${when} with no conversions. What's going wrong and should we pause or fix ${wasting.length === 1 ? "it" : "them"}?`,
      })
    }
  }

  // Search ads people see but don't click.
  const lowCtr = report.campaigns.filter(
    (c) => c.channel === "SEARCH" && c.impressions >= 500 && c.clicks / c.impressions < 0.02,
  )
  if (lowCtr.length) {
    issues.push({
      id: "low-ctr",
      severity: "medium",
      title: `${lowCtr.length} search campaign${lowCtr.length === 1 ? " has" : "s have"} a low click rate`,
      detail: `${list(lowCtr.map((c) => `${c.name} (${((c.clicks / c.impressions) * 100).toFixed(1)}%)`))}. Under 2% on search usually means the ads don't match what people searched.`,
      fix: "Rewrite headlines to repeat the searcher's words (\"Sell your house fast for cash\"), add sitelinks and callouts, and remove keywords that don't fit.",
      question: `These search campaigns have a click rate under 2%: ${list(lowCtr.map((c) => c.name), 10)}. How can we improve the ads and keywords?`,
    })
  }

  // Keywords Google rates poorly, which makes every click cost more.
  if (keywordRows) {
    const poor = keywordRows
      .map((r) => {
        const criterion = r.adGroupCriterion as { keyword?: { text?: string }; qualityInfo?: { qualityScore?: number } } | undefined
        return {
          text: criterion?.keyword?.text ?? "",
          score: criterion?.qualityInfo?.qualityScore,
          cost: Number((r.metrics as { costMicros?: string } | undefined)?.costMicros ?? 0) / 1_000_000,
        }
      })
      .filter((k) => k.text && k.score !== undefined && k.score <= 3)
    if (poor.length) {
      const spent = poor.reduce((sum, k) => sum + k.cost, 0)
      issues.push({
        id: "quality-score",
        severity: "medium",
        title: `${poor.length} keyword${poor.length === 1 ? " has" : "s have"} a poor Quality Score`,
        detail: `${list(poor.map((k) => `${k.text} (${k.score}/10)`))} cost ${money(spent)}. A score of 3 or less makes each click cost more.`,
        fix: "Put these keywords in ad groups whose ads and landing page use the same words, or pause the ones that don't bring leads.",
        question: `These keywords have a Quality Score of 3 or less: ${list(poor.map((k) => `${k.text} (${k.score}/10)`), 10)}. How do we raise their Quality Score?`,
      })
    }
  }

  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1))
}

// Serious ones go before the problems already listed, the rest after them.
const addIssues = (issues: Issue[], more: (Issue | null)[]) => {
  const found = more.filter((i): i is Issue => i !== null)
  return [...found.filter((i) => i.severity === "high"), ...issues, ...found.filter((i) => i.severity !== "high")]
}

// Every problem the dashboard and the daily check show: the account checks above plus wasted
// searches, locations and missed calls, most serious first.
export async function collectIssues(
  connection: AdsConnection,
  account: AdsAccount,
  report: AdsReport,
  period: Period,
  found: {
    wasted: WastedSummary
    costPerConversion: number
    locations: LocationReport | { error: string }
    calls: { calls: Call[] } | { error: string }
    callDays: number
  },
): Promise<Issue[]> {
  let issues = await getHealthIssues(connection, account, report, period)
  issues = addIssues(issues, [wastedSearchIssue(found.wasted, account.currency, found.costPerConversion, period)])
  if (!("error" in found.locations)) {
    issues = addIssues(issues, locationIssues(found.locations, report, account.currency, period))
  }
  return addIssues(issues, ["calls" in found.calls ? missedCallIssue(found.calls.calls, period.preset === "all" ? `in the last ${found.callDays} days` : describePeriod(period)) : null])
}
