// The daily Google Ads check: pulls the same numbers and problems the dashboard shows for the last
// 7, 30 and 90 days and all time, and writes them as JSON files (one per period, plus meta.json)
// for the live Command Center page, and summary.md, a plain-English list of what's wrong today.
//
//   npm run daily-check -- <output folder>
//
// Reads GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
// GOOGLE_ADS_DEVELOPER_TOKEN (and optionally GOOGLE_ADS_CUSTOMER_ID) from the environment or from
// .env.local. The refresh token must come from the same Google client as GOOGLE_CLIENT_ID.
// If <output folder>/previous-p30.json exists (yesterday's p30.json), searches that weren't in it
// are marked new.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { AdsApiError, getReport, getSearchTerms, listAccounts, type AdsReport } from "@/lib/google/ads"
import type { AdsConnection } from "@/lib/google/connections"
import { collectIssues, type Issue } from "@/lib/google/health"
import { tryGetCalls } from "@/lib/google/calls"
import { tryGetLocations } from "@/lib/google/locations"
import { resolvePeriod } from "@/lib/google/period"
import { findWastedSearches } from "@/lib/google/wasted-searches"

const out = path.resolve(process.argv[2] ?? ".data/daily-check")
mkdirSync(out, { recursive: true })

// Settings missing from the environment come from .env.local (Windows line endings included).
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]?.trim() && m[2].trim()) process.env[m[1]] = m[2].trim()
  }
}
const missing = ["GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"].filter(
  (name) => !process.env[name]?.trim(),
)
if (missing.length) {
  console.error(`Missing settings: ${missing.join(", ")}`)
  process.exit(2)
}

const r2 = (n: number) => Math.round(n * 100) / 100
const short = (iso: string, year = false) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  })

// Spend and conversions per day, week (starting Sunday) or month, for the chart.
function series(daily: AdsReport["daily"], grp: "day" | "week" | "month") {
  const points = new Map<string, [string, number, number]>()
  for (const d of daily) {
    let key = d.date
    let label = short(d.date)
    if (grp === "week") {
      const sunday = new Date(`${d.date}T00:00:00Z`)
      sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay())
      key = sunday.toISOString().slice(0, 10)
      label = `Week of ${short(key)}`
    } else if (grp === "month") {
      key = d.date.slice(0, 7)
      label = new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    }
    const point = points.get(key) ?? [label, 0, 0]
    point[1] += d.cost
    point[2] += d.conversions
    points.set(key, point)
  }
  return [...points.values()].map(([label, spend, conv]) => [label, r2(spend), r2(conv)])
}

async function main() {
  const base: AdsConnection = {
    email: "",
    connectedAt: new Date().toISOString(),
    accounts: [],
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN!.trim(),
  }
  const accounts = await listAccounts(base)
  const wanted = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "").replace(/\D/g, "")
  const account =
    accounts.find((a) => a.customerId === wanted) ?? accounts.find((a) => !a.test) ?? accounts[0]
  if (!account) throw new AdsApiError("This Google account can't open any Google Ads accounts.")
  const connection = { ...base, accounts, selectedCustomerId: account.customerId }

  // Yesterday's wasted searches, per period: the full list this script saved last time
  // (seen-p7.json ...), or for 30 days the previous-p30.json handed in.
  const seenBeforeFor = (id: string) => {
    const seenFile = path.join(out, `seen-${id}.json`)
    if (existsSync(seenFile)) return new Set<string>(JSON.parse(readFileSync(seenFile, "utf8")) as string[])
    const previousFile = path.join(out, "previous-p30.json")
    if (id === "p30" && existsSync(previousFile)) {
      return new Set<string>((JSON.parse(readFileSync(previousFile, "utf8")).wasted ?? []).map((w: { term: string }) => w.term.toLowerCase()))
    }
    return new Set<string>()
  }

  const periods = [
    ["p7", "7", "day"],
    ["p30", "30", "day"],
    ["p90", "90", "week"],
    ["pall", "all", "month"],
  ] as const
  let today: { issues: Issue[]; label: string; spend: number; conversions: number } | null = null

  for (const [id, range, grp] of periods) {
    const period = resolvePeriod({ range })
    const callDays = range === "all" ? 365 : Number(range)
    const [report, terms, locations, calls] = await Promise.all([
      getReport(connection, account, period),
      getSearchTerms(connection, account, period).catch(() => []),
      tryGetLocations(connection, account, period),
      tryGetCalls(connection, account, callDays, range === "all" ? undefined : { start: period.start, end: period.end }),
    ])
    const { totals } = report
    const costPerConversion = totals.conversions ? totals.cost / totals.conversions : 0
    const wasted = findWastedSearches(terms, costPerConversion)
    const seenBefore = seenBeforeFor(id)
    for (const w of wasted.wasted) w.isNew = seenBefore.size > 0 && !seenBefore.has(w.term.toLowerCase())
    writeFileSync(path.join(out, `seen-${id}.json`), JSON.stringify(wasted.wasted.map((w) => w.term.toLowerCase())))

    const issues = await collectIssues(connection, account, report, period, { wasted, costPerConversion, locations, calls, callDays })

    const label = `${short(report.start, true)} – ${short(report.end, true)}`
    writeFileSync(
      path.join(out, `${id}.json`),
      JSON.stringify({
        label,
        start: report.start,
        end: report.end,
        grp,
        spend: r2(totals.cost),
        clicks: totals.clicks,
        conversions: r2(totals.conversions),
        impressions: totals.impressions,
        series: series(report.daily, grp),
        campaigns: report.campaigns
          .filter((c) => c.cost > 0 || c.clicks > 0)
          .slice(0, 100)
          .map((c) => ({ name: c.name, status: c.status, spend: r2(c.cost), clicks: c.clicks, conversions: r2(c.conversions) })),
        wasted: wasted.wasted.slice(0, 100).map((w) => ({
          term: w.term,
          why: w.reason,
          cost: r2(w.cost),
          clicks: w.clicks,
          campaign: w.campaign,
          negative: w.negative,
          isNew: Boolean(w.isNew),
        })),
        wastedTotal: r2(wasted.total),
        calls: "calls" in calls ? { total: calls.calls.length, missed: calls.calls.filter((c) => c.missed).length } : null,
        locations:
          "error" in locations
            ? { error: locations.error }
            : {
                targets: locations.targets,
                places: locations.places.slice(0, 100).map((p) => ({
                  name: p.name,
                  inTarget: p.inTarget,
                  spend: r2(p.cost),
                  clicks: p.clicks,
                  conversions: r2(p.conversions),
                })),
              },
        issues: issues.map((i) => ({
          level: i.severity === "high" ? "bad" : "warn",
          title: i.title,
          detail: i.detail,
          fix: i.fix,
          question: i.question,
        })),
      }),
    )
    if (id === "p30") today = { issues, label, spend: totals.cost, conversions: totals.conversions }
    console.log(`${id}: ${label}, ${issues.length} problems`)
  }

  writeFileSync(
    path.join(out, "meta.json"),
    JSON.stringify({ account: account.name || account.customerId, currency: account.currency, updatedAt: new Date().toISOString() }),
  )

  // The morning message: what's wrong in the last 30 days, most serious first, and how to fix it.
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: account.currency }).format(n)
  const { issues = [], label = "", spend = 0, conversions = 0 } = today ?? {}
  const lines = [
    `# Google Ads check: ${account.name}`,
    "",
    `Last 30 days (${label}): ${money(spend)} spent, ${r2(conversions)} conversions${conversions ? `, ${money(spend / conversions)} per conversion` : ""}.`,
    "",
    issues.length ? `## ${issues.length} thing${issues.length === 1 ? "" : "s"} to fix, most serious first` : "## Nothing needs fixing today",
    ...issues.flatMap((i, n) => ["", `${n + 1}. **${i.title}**${i.severity === "high" ? " (serious)" : ""}`, `   ${i.detail}`, `   How to fix: ${i.fix}`]),
  ]
  writeFileSync(path.join(out, "summary.md"), `${lines.join("\n")}\n`)
  console.log(`Wrote ${out}`)
}

main().catch((error) => {
  console.error(`Daily check failed: ${error instanceof Error ? error.message : String(error)}`)
  if (error instanceof Error && /unauthorized/i.test(error.message)) {
    console.error(
      "Google refused the refresh token. It has to be created with the same client as GOOGLE_CLIENT_ID (in the OAuth Playground, tick \"Use your own OAuth credentials\").",
    )
  }
  process.exit(1)
})
