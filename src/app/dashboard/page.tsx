import type { Metadata } from "next"
import { CircleAlert, CircleCheck, ExternalLink, RefreshCw } from "lucide-react"

import AppHeader from "@/components/app-header"
import AccountSelect from "@/components/dashboard/account-select"
import AssistantLauncher from "@/components/dashboard/assistant-launcher"
import { AdsError, ConnectAds, DisconnectButton, SetupNeeded } from "@/components/dashboard/ads-panels"
import {
  formatDateRange,
  formatMoney,
  formatNumber,
  formatPercent,
} from "@/components/dashboard/format"
import PeriodPicker from "@/components/dashboard/period-picker"
import TrendChart from "@/components/dashboard/trend-chart"
import WastedSearches from "@/components/dashboard/wasted-searches"
import DashboardTabs from "@/components/dashboard/dashboard-tabs"
import HealthCheck from "@/components/dashboard/health-check"
import AtAGlance from "@/components/dashboard/at-a-glance"
import {
  AdsPanel,
  ConversionsPanel,
  DevicesPanel,
  KeywordsPanel,
  TimingPanel,
  adProblems,
  conversionProblems,
  keywordProblems,
} from "@/components/dashboard/insights"
import Locations from "@/components/dashboard/locations"
import Paged from "@/components/ui/paged"
import GoogleAdsMark from "@/components/google-ads-mark"
import { Button } from "@/components/ui/button"
import { assistantProvider } from "@/lib/assistant/shared"
import { adsConfig } from "@/lib/auth/config"
import { requireSession, type Session } from "@/lib/auth/session"
import { refreshAccountsAction, selectAccountAction } from "@/lib/google/actions"
import {
  AdsApiError,
  chosenAccount,
  formatCustomerId,
  getReport,
  getSearchTerms,
  listAccounts,
  type AdsReport,
  type SearchTerm,
} from "@/lib/google/ads"
import { getConnection, updateConnection, type AdsConnection } from "@/lib/google/connections"
import { collectIssues, type Issue } from "@/lib/google/health"
import { describePeriod, periodQuery, resolvePeriod, type Period } from "@/lib/google/period"
import { firstSeen } from "@/lib/google/seen-searches"
import { tryGetCalls } from "@/lib/google/calls"
import { getInsights, type Insights } from "@/lib/google/insights"
import { tryGetLocations, type LocationReport } from "@/lib/google/locations"
import { findWastedSearches, searchKey, type WastedSummary } from "@/lib/google/wasted-searches"
import { dashboardCache } from "@/lib/shared-state"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Google Ads · One Marketing Command Center" }

const notices: Record<string, { tone: "ok" | "error"; text: string }> = {
  connected: { tone: "ok", text: "Google Ads is connected." },
  cancelled: { tone: "error", text: "Connecting Google Ads was cancelled." },
  scope: {
    tone: "error",
    text: "Google Ads wasn't connected because the permission to see your Google Ads was left unticked. Try again and tick that box.",
  },
  no_refresh_token: {
    tone: "error",
    text: "Google didn't grant lasting access. Try connecting again.",
  },
  failed: { tone: "error", text: "Connecting Google Ads didn't go through. Please try again." },
}

// A wasted search counts as new for a day after it's first spotted.
const NEW_FOR_MS = 24 * 60 * 60 * 1000

// Accounts are looked up once and kept for a day; "Refresh account list" looks again.
const ACCOUNTS_MAX_AGE = 24 * 60 * 60 * 1000

type Loaded =
  | { kind: "setup"; missing: string[] }
  | { kind: "connect" }
  | { kind: "error"; message: string; code?: string }
  | { kind: "no-accounts"; connection: AdsConnection }
  | {
      kind: "report"
      connection: AdsConnection
      report: AdsReport
      // Search terms load separately, so a problem with them doesn't hide the rest.
      searchTerms: { terms: SearchTerm[] } | { error: string }
      wasted: WastedSummary
      locations: LocationReport | { error: string }
      insights: Insights
      previous: AdsReport | null
      calls: { total: number; missed: number } | null
      issues: Issue[]
    }

async function load(user: Session, period: Period): Promise<Loaded> {
  if (!adsConfig().developerToken) return { kind: "setup", missing: ["GOOGLE_ADS_DEVELOPER_TOKEN"] }
  const connection = await getConnection(user.sub)
  if (!connection) return { kind: "connect" }

  try {
    const fresh =
      connection.accountsFetchedAt &&
      Date.now() - Date.parse(connection.accountsFetchedAt) < ACCOUNTS_MAX_AGE
    if (!connection.accounts.length || !fresh) {
      connection.accounts = await listAccounts(connection)
      await updateConnection(user.sub, {
        accounts: connection.accounts,
        accountsFetchedAt: new Date().toISOString(),
      })
    }
    const account =
      chosenAccount(connection.accounts, connection.selectedCustomerId, connection.email)
    if (!account) return { kind: "no-accounts", connection }
    // Calls cover the same stretch as the period (all time: the last year).
    const callDays = Math.min(365, Math.round((Date.parse(period.end) - Date.parse(period.start)) / 86_400_000) + 1)
    // The same number of days just before, for "better or worse than before" (not for all time).
    const days = Math.round((Date.parse(period.end) - Date.parse(period.start)) / 86_400_000) + 1
    const shift = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
    const before: Period | null =
      period.preset === "all" ? null : { preset: "custom", start: shift(period.start, -days), end: shift(period.start, -1), today: period.today }
    const [report, searchTerms, locations, calls, insights, previous] = await Promise.all([
      getReport(connection, account, period),
      getSearchTerms(connection, account, period).then(
        (terms) => ({ terms }),
        (error) => ({
          error: error instanceof AdsApiError ? error.message : "Google Ads didn't return search terms.",
        }),
      ),
      tryGetLocations(connection, account, period),
      tryGetCalls(connection, account, callDays, period.preset === "all" ? undefined : { start: period.start, end: period.end }),
      getInsights(connection, account, period),
      before ? getReport(connection, account, before).catch(() => null) : Promise.resolve(null),
    ])
    const { totals } = report
    const costPerConversion = totals.conversions ? totals.cost / totals.conversions : 0
    const wasted = findWastedSearches("terms" in searchTerms ? searchTerms.terms : [], costPerConversion)
    // New searches are spotted in the usual last-30-days view; other ranges only look them up.
    const seen = await firstSeen(user.sub, account.customerId, wasted.wasted.map(searchKey), Date.now(), period.preset === "30")
    for (const w of wasted.wasted) {
      w.isNew = Date.now() - Date.parse(seen.get(searchKey(w)) ?? "") < NEW_FOR_MS
    }

    const issues = await collectIssues(connection, account, report, period, { wasted, costPerConversion, locations, calls, callDays })
    const callSummary = "calls" in calls ? { total: calls.calls.length, missed: calls.calls.filter((c) => c.missed).length } : null
    return {
      kind: "report",
      connection,
      report,
      searchTerms,
      wasted,
      locations,
      insights,
      previous,
      calls: callSummary,
      issues,
    }
  } catch (error) {
    if (error instanceof AdsApiError) return { kind: "error", message: error.message, code: error.code }
    console.error("Google Ads request failed:", error)
    return { kind: "error", message: "Couldn't reach Google Ads. Check your internet connection and try again." }
  }
}

const humanize = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

// Long ranges would squeeze hundreds of days into one chart, so group them by week or month.
function groupForChart(daily: AdsReport["daily"]) {
  const unit = daily.length > 400 ? "month" : daily.length > 120 ? "week" : "day"
  if (unit === "day") return { unit, points: daily }
  const groups = new Map<string, { date: string; cost: number; clicks: number }>()
  for (const d of daily) {
    let key = d.date.slice(0, 7) + "-01"
    if (unit === "week") {
      const day = new Date(`${d.date}T00:00:00Z`)
      day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7)) // back to Monday
      key = day.toISOString().slice(0, 10)
    }
    const g = groups.get(key) ?? { date: key, cost: 0, clicks: 0 }
    g.cost += d.cost
    g.clicks += d.clicks
    groups.set(key, g)
  }
  return { unit, points: [...groups.values()] }
}

const LOCATION_ISSUES = new Set(["no-location-targets", "presence-or-interest", "outside-target-area", "cities-without-leads"])

// A tab's highlight: red when it holds a serious problem, amber for one worth a look.
const toneOf = (issues: Issue[]) =>
  issues.some((i) => i.severity === "high") ? ("bad" as const) : issues.length ? ("warn" as const) : undefined

// Google Ads numbers change slowly (Google itself updates them every few hours), so the same
// report is reused for a few minutes: moving between pages and back doesn't ask Google again.
const RECENT_MS = 3 * 60_000
const recent = dashboardCache() as Map<string, { at: number; result: Promise<Loaded> }>
async function loadRecent(user: Session, period: Period) {
  const connection = await getConnection(user.sub)
  // ("Refresh account list" empties this cache, so it asks Google again.)
  const key = JSON.stringify([user.sub, connection?.refreshToken.slice(-8), connection?.selectedCustomerId, period])
  const hit = recent.get(key)
  if (hit && Date.now() - hit.at < RECENT_MS) return hit.result
  const result = load(user, period)
  recent.set(key, { at: Date.now(), result })
  // Only keep full reports; anything else (an error, a setup step) is asked again next time.
  result.then(
    (r) => r.kind !== "report" && recent.delete(key),
    () => recent.delete(key),
  )
  for (const [k, v] of recent) if (Date.now() - v.at > RECENT_MS) recent.delete(k)
  return result
}

const statusLabel: Record<string, string> = { ENABLED: "Active", PAUSED: "Paused" }

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireSession("/dashboard")
  const q = await searchParams
  const period = resolvePeriod(q)
  const loaded = await loadRecent(user, period)

  const assistantEnabled = assistantProvider() !== null
  const noticeKey =
    q.connected === "1" ? "connected" : typeof q.ads_error === "string" ? q.ads_error : null
  const notice = noticeKey ? (notices[noticeKey] ?? notices.failed) : null

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/dashboard" user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-8 pb-28 sm:px-6 lg:pt-10">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <GoogleAdsMark className="size-9" />
            Google Ads
          </h1>
          <p className="mt-1 text-muted-foreground">
            {loaded.kind === "report"
              ? `${loaded.report.account.name} · ${formatDateRange(loaded.report.start, loaded.report.end)}`
              : "Your campaigns, straight from your Google Ads account."}
          </p>
        </div>

        {notice && (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={cn(
              "flex gap-2 rounded-xl p-3 text-sm",
              notice.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-800",
            )}
          >
            {notice.tone === "error" ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CircleCheck className="mt-0.5 size-4 shrink-0" />
            )}
            {notice.text}
          </p>
        )}

        {loaded.kind === "setup" && <SetupNeeded missing={loaded.missing} />}
        {loaded.kind === "connect" && <ConnectAds />}
        {loaded.kind === "error" && <AdsError message={loaded.message} code={loaded.code} />}
        {loaded.kind === "no-accounts" && (
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-xs sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight">No Google Ads accounts found</h2>
            <p className="text-muted-foreground">
              {loaded.connection.email} doesn&apos;t have access to any active Google Ads accounts.
              Connect a different Google account, or ask the account owner to invite this one.
            </p>
            <AccountActions />
          </section>
        )}
        {loaded.kind === "report" && (
          <Report
            report={loaded.report}
            searchTerms={loaded.searchTerms}
            wasted={loaded.wasted}
            locations={loaded.locations}
            insights={loaded.insights}
            previous={loaded.previous}
            calls={loaded.calls}
            issues={loaded.issues}
            connection={loaded.connection}
            period={period}
          />
        )}
      </main>
      <AssistantLauncher
        enabled={assistantEnabled}
        context={
          loaded.kind === "report"
            ? `The dashboard is showing ${loaded.report.start} to ${loaded.report.end} (${describePeriod(period)}).`
            : undefined
        }
      />
    </div>
  )
}

function AccountActions() {
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      <a
        href="https://ads.google.com/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ExternalLink className="size-4" />
        Open Google Ads
      </a>
      <form action={refreshAccountsAction}>
        <Button type="submit" variant="ghost" size="lg" className="text-muted-foreground">
          <RefreshCw data-icon="inline-start" />
          Refresh account list
        </Button>
      </form>
      <DisconnectButton />
    </div>
  )
}

function Report({
  report,
  searchTerms,
  wasted,
  locations,
  insights,
  previous,
  calls,
  issues,
  connection,
  period,
}: {
  report: AdsReport
  searchTerms: { terms: SearchTerm[] } | { error: string }
  wasted: WastedSummary
  locations: LocationReport | { error: string }
  insights: Insights
  previous: AdsReport | null
  calls: { total: number; missed: number } | null
  issues: Issue[]
  connection: AdsConnection
  period: Period
}) {
  const { account, totals } = report
  const money = (n: number, cents = false) => formatMoney(n, account.currency, cents)
  const chart = groupForChart(report.daily)
  const locationProblems = issues.filter((i) => LOCATION_ISSUES.has(i.id))
  const costPerLead = totals.conversions ? totals.cost / totals.conversions : 0
  const shareByCampaign = new Map("rows" in insights.share ? insights.share.rows.map((r) => [r.campaign, r]) : [])
  const pct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v <= 0.1 && v > 0 ? "< 10%" : formatPercent(v, 0))
  const kwProblems = "rows" in insights.keywords ? keywordProblems(insights.keywords.rows, costPerLead) : 0
  const adIssues = "rows" in insights.ads ? adProblems(insights.ads.rows) : 0
  const convIssues = "rows" in insights.conversions ? conversionProblems(insights.conversions.rows) : 0
  const campaignsWithoutLeads = report.campaigns.filter((c) => c.cost > 0 && c.conversions < 0.5).length

  return (
    <>
      <div className="flex flex-col gap-4">
        {connection.accounts.length > 1 && (
          <form action={selectAccountAction} className="flex flex-wrap items-center gap-2">
            <label htmlFor="customerId" className="text-sm font-medium">
              Account
            </label>
            <AccountSelect
              current={account.customerId}
              options={connection.accounts.map((a) => ({
                value: a.customerId,
                label: `${a.name} (${formatCustomerId(a.customerId)})${a.managerName ? ` · via ${a.managerName}` : ""}`,
              }))}
            />
            <input type="hidden" name="period" value={periodQuery(period)} />
            <Button type="submit" variant="outline" size="lg">
              Show
            </Button>
          </form>
        )}
        <PeriodPicker period={period} />
        {account.test && (
          <p className="rounded-xl bg-muted p-3 text-sm">
            This is a Google Ads test account, so these numbers aren&apos;t real ad spend.
          </p>
        )}
      </div>

      <DashboardTabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: "overview",
            content: (
            <AtAGlance
              report={report}
              previous={previous}
              issues={issues}
              wastedTotal={wasted.total}
              calls={calls}
              periodLabel={describePeriod(period)}
            />
            ),
          },
          {
            id: "health",
            icon: "problems",
            label: "Problems",
            count: issues.length,
            tone: toneOf(issues),
            content: <HealthCheck issues={issues} />,
          },
          {
            id: "wasted",
            icon: "wasted",
            label: "Searches to remove",
            count: wasted.wasted.length,
            tone: toneOf(issues.filter((i) => i.id === "wasted-searches")),
            content: (
              <WastedSearches
                {...wasted}
                currency={account.currency}
                error={"error" in searchTerms ? searchTerms.error : undefined}
              />
            ),
          },
          {
            id: "locations",
            icon: "locations",
            label: "Locations",
            count: locationProblems.length,
            tone: toneOf(locationProblems),
            content: <Locations locations={locations} currency={account.currency} />,
          },
          {
            id: "campaigns",
            icon: "campaigns",
            label: "Campaigns",
            count: campaignsWithoutLeads,
            tone: campaignsWithoutLeads ? "warn" : undefined,
            content: (
              <section className="rounded-2xl border bg-card shadow-xs">
                <h2 className="px-5 pt-5 text-lg font-semibold sm:px-6">Campaigns</h2>
                {report.campaigns.length ? (
                  <Paged
                    noun="campaigns"
                    table={{
                      className: "w-full min-w-[1000px] text-sm",
                      bodyClassName: "divide-y tabular-nums",
                      head: (
                        <thead className="text-left text-xs text-muted-foreground">
                          <tr className="border-b">
                            <th className="px-5 py-3 font-medium sm:px-6">Campaign</th>
                            <th className="px-3 py-3 text-right font-medium">Spend</th>
                            <th className="px-3 py-3 text-right font-medium">Impr.</th>
                            <th className="px-3 py-3 text-right font-medium">Clicks</th>
                            <th className="px-3 py-3 text-right font-medium">Click rate</th>
                            <th className="px-3 py-3 text-right font-medium">Conv.</th>
                            <th className="px-3 py-3 text-right font-medium">Cost / conv.</th>
                            <th className="px-3 py-3 text-right font-medium" title="How often your ads showed when they could have (search campaigns)">
                              Impr. share
                            </th>
                            <th className="px-3 py-3 text-right font-medium">Lost to budget</th>
                            <th className="px-5 py-3 text-right font-medium sm:px-6">Lost to rank</th>
                          </tr>
                        </thead>
                      ),
                    }}
                    items={report.campaigns.map((c) => (
                      <tr key={c.id} className={c.cost > 0 && c.conversions < 0.5 ? "bg-destructive/5" : undefined}>
                        <td className="px-5 py-3 sm:px-6">
                          <p className="font-medium">
                            {c.name}
                            {c.cost > 0 && c.conversions < 0.5 && (
                              <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 align-middle text-xs font-medium text-destructive">
                                No leads
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {statusLabel[c.status] ?? humanize(c.status)}
                            {c.channel && ` · ${humanize(c.channel)}`}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right">{money(c.cost, true)}</td>
                        <td className="px-3 py-3 text-right">{formatNumber(c.impressions)}</td>
                        <td className="px-3 py-3 text-right">{formatNumber(c.clicks)}</td>
                        <td className="px-3 py-3 text-right">
                          {formatPercent(c.impressions ? c.clicks / c.impressions : 0)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatNumber(Math.round(c.conversions * 10) / 10)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {c.conversions ? money(c.cost / c.conversions, true) : "–"}
                        </td>
                        <td className="px-3 py-3 text-right">{pct(shareByCampaign.get(c.name)?.impressionShare)}</td>
                        <td
                          className={cn(
                            "px-3 py-3 text-right",
                            (shareByCampaign.get(c.name)?.lostToBudget ?? 0) >= 0.2 && "font-semibold text-destructive",
                          )}
                        >
                          {pct(shareByCampaign.get(c.name)?.lostToBudget)}
                        </td>
                        <td className="px-5 py-3 text-right sm:px-6">{pct(shareByCampaign.get(c.name)?.lostToRank)}</td>
                      </tr>
                    ))}
                  />
                ) : (
                  <p className="px-5 py-6 text-sm text-muted-foreground sm:px-6">
                    No campaign activity in this period.
                  </p>
                )}
              </section>
            ),
          },
          {
            id: "keywords",
            icon: "keywords",
            label: "Keywords",
            count: kwProblems,
            tone: kwProblems ? "warn" : undefined,
            content: <KeywordsPanel part={insights.keywords} money={money} costPerLead={costPerLead} />,
          },
          {
            id: "ads",
            icon: "ads",
            label: "Ads",
            count: adIssues,
            tone: adIssues ? "bad" : undefined,
            content: <AdsPanel part={insights.ads} money={money} />,
          },
          { id: "devices", icon: "devices", label: "Devices", content: <DevicesPanel part={insights.devices} money={money} /> },
          { id: "times", icon: "times", label: "Best times", content: <TimingPanel part={insights.times} money={money} /> },
          {
            id: "conversions",
            icon: "conversions",
            label: "Conversion tracking",
            count: convIssues,
            tone: convIssues ? "bad" : undefined,
            content: <ConversionsPanel part={insights.conversions} />,
          },
          {
            id: "trends",
            icon: "trends",
            label: "Trends",
            content: (
              <section className="grid gap-6 rounded-2xl border bg-card p-5 shadow-xs sm:p-6 lg:grid-cols-2">
                <TrendChart
                  label={`Spend per ${chart.unit} (${account.currency})`}
                  color="var(--primary)"
                  data={chart.points.map((d) => ({ date: d.date, value: Math.round(d.cost * 100) / 100 }))}
                />
                <TrendChart
                  label={`Clicks per ${chart.unit}`}
                  color="var(--chart-2, #0ea5e9)"
                  data={chart.points.map((d) => ({ date: d.date, value: d.clicks }))}
                />
              </section>
            ),
          },
        ]}
      />

      <p className="text-xs text-muted-foreground">
        Connected as {connection.email}. Account {formatCustomerId(account.customerId)}
        {account.managerName ? `, through ${account.managerName}` : ""}. Today&apos;s numbers show up
        tomorrow.
      </p>
      <AccountActions />
    </>
  )
}
