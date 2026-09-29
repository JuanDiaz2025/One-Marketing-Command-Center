import type { Metadata } from "next"
import { CircleAlert, CircleCheck, ExternalLink, RefreshCw } from "lucide-react"

import AppHeader from "@/components/app-header"
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
import HealthCheck from "@/components/dashboard/health-check"
import Paged from "@/components/ui/paged"
import GoogleAdsMark from "@/components/google-ads-mark"
import { Button } from "@/components/ui/button"
import { assistantProvider } from "@/lib/assistant/shared"
import { adsConfig } from "@/lib/auth/config"
import { requireSession, type Session } from "@/lib/auth/session"
import { refreshAccountsAction, selectAccountAction } from "@/lib/google/actions"
import {
  AdsApiError,
  formatCustomerId,
  getReport,
  getSearchTerms,
  listAccounts,
  type AdsReport,
  type SearchTerm,
} from "@/lib/google/ads"
import { getConnection, updateConnection, type AdsConnection } from "@/lib/google/connections"
import { getHealthIssues, wastedSearchIssue, type Issue } from "@/lib/google/health"
import { describePeriod, periodQuery, resolvePeriod, type Period } from "@/lib/google/period"
import { firstSeen } from "@/lib/google/seen-searches"
import { findWastedSearches, searchKey, type WastedSummary } from "@/lib/google/wasted-searches"
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
      connection.accounts.find((a) => a.customerId === connection.selectedCustomerId) ??
      connection.accounts[0]
    if (!account) return { kind: "no-accounts", connection }
    const [report, searchTerms] = await Promise.all([
      getReport(connection, account, period),
      getSearchTerms(connection, account, period).then(
        (terms) => ({ terms }),
        (error) => ({
          error: error instanceof AdsApiError ? error.message : "Google Ads didn't return search terms.",
        }),
      ),
    ])
    const { totals } = report
    const costPerConversion = totals.conversions ? totals.cost / totals.conversions : 0
    const wasted = findWastedSearches("terms" in searchTerms ? searchTerms.terms : [], costPerConversion)
    const seen = await firstSeen(user.sub, account.customerId, wasted.wasted.map(searchKey))
    for (const w of wasted.wasted) {
      w.isNew = Date.now() - Date.parse(seen.get(searchKey(w)) ?? "") < NEW_FOR_MS
    }

    const issues = await getHealthIssues(connection, account, report, period)
    const wastedIssue = wastedSearchIssue(wasted, account.currency, costPerConversion, period)
    if (wastedIssue) issues.splice(wastedIssue.severity === "high" ? 0 : issues.length, 0, wastedIssue)
    return { kind: "report", connection, report, searchTerms, wasted, issues }
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

const statusLabel: Record<string, string> = { ENABLED: "Active", PAUSED: "Paused" }

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireSession("/dashboard")
  const q = await searchParams
  const period = resolvePeriod(q)
  const loaded = await load(user, period)

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
            health={<HealthCheck issues={loaded.issues} />}
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
  health,
  connection,
  period,
}: {
  report: AdsReport
  searchTerms: { terms: SearchTerm[] } | { error: string }
  wasted: WastedSummary
  health: React.ReactNode
  connection: AdsConnection
  period: Period
}) {
  const { account, totals } = report
  const money = (n: number, cents = false) => formatMoney(n, account.currency, cents)
  const chart = groupForChart(report.daily)
  const kpis = [
    { label: "Spend", value: money(totals.cost), note: `${formatNumber(totals.impressions)} impressions` },
    {
      label: "Clicks",
      value: formatNumber(totals.clicks),
      note: `${formatPercent(totals.impressions ? totals.clicks / totals.impressions : 0)} click rate`,
    },
    {
      label: "Conversions",
      value: formatNumber(Math.round(totals.conversions * 10) / 10),
      note: totals.conversions ? `${money(totals.cost / totals.conversions, true)} each` : "none yet",
    },
  ]

  return (
    <>
      <div className="flex flex-col gap-4">
        {connection.accounts.length > 1 && (
          <form action={selectAccountAction} className="flex flex-wrap items-center gap-2">
            <label htmlFor="customerId" className="text-sm font-medium">
              Account
            </label>
            <select
              id="customerId"
              name="customerId"
              defaultValue={account.customerId}
              className="h-10 max-w-full min-w-0 rounded-lg border bg-card px-3 text-sm"
            >
              {connection.accounts.map((a) => (
                <option key={a.customerId} value={a.customerId}>
                  {a.name} ({formatCustomerId(a.customerId)}){a.managerName ? ` · via ${a.managerName}` : ""}
                </option>
              ))}
            </select>
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

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border bg-card p-5 shadow-xs">
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{kpi.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>
          </div>
        ))}
      </section>

      {health}

      <WastedSearches
        {...wasted}
        currency={account.currency}
        error={"error" in searchTerms ? searchTerms.error : undefined}
      />

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

      <section className="rounded-2xl border bg-card shadow-xs">
        <h2 className="px-5 pt-5 text-lg font-semibold sm:px-6">Campaigns</h2>
        {report.campaigns.length ? (
          <Paged
            noun="campaigns"
            table={{
              className: "w-full min-w-[720px] text-sm",
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
                    <th className="px-5 py-3 text-right font-medium sm:px-6">Cost / conv.</th>
                  </tr>
                </thead>
              ),
            }}
            items={report.campaigns.map((c) => (
              <tr key={c.id}>
                <td className="px-5 py-3 sm:px-6">
                  <p className="font-medium">{c.name}</p>
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
                <td className="px-5 py-3 text-right sm:px-6">
                  {c.conversions ? money(c.cost / c.conversions, true) : "–"}
                </td>
              </tr>
            ))}
          />
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground sm:px-6">
            No campaign activity in this period.
          </p>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Connected as {connection.email}. Account {formatCustomerId(account.customerId)}
        {account.managerName ? `, through ${account.managerName}` : ""}. Today&apos;s numbers show up
        tomorrow.
      </p>
      <AccountActions />
    </>
  )
}
