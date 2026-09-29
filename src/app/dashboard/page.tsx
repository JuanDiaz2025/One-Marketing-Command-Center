import type { Metadata } from "next"
import Link from "next/link"
import { CircleAlert, CircleCheck, ExternalLink, RefreshCw } from "lucide-react"

import AppHeader from "@/components/app-header"
import Assistant from "@/components/dashboard/assistant"
import { AdsError, ConnectAds, DisconnectButton, SetupNeeded } from "@/components/dashboard/ads-panels"
import {
  formatDateRange,
  formatMoney,
  formatNumber,
  formatPercent,
} from "@/components/dashboard/format"
import TrendChart from "@/components/dashboard/trend-chart"
import WastedSearches from "@/components/dashboard/wasted-searches"
import GoogleAdsMark from "@/components/google-ads-mark"
import { Button } from "@/components/ui/button"
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
import { findWastedSearches } from "@/lib/google/wasted-searches"
import { listLeads } from "@/lib/leads/store"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Google Ads · One Marketing Command Center" }

const ranges = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
]

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
    }

async function load(user: Session, days: number): Promise<Loaded> {
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
      getReport(connection, account, days),
      getSearchTerms(connection, account, days).then(
        (terms) => ({ terms }),
        (error) => ({
          error: error instanceof AdsApiError ? error.message : "Google Ads didn't return search terms.",
        }),
      ),
    ])
    return { kind: "report", connection, report, searchTerms }
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

const statusLabel: Record<string, string> = { ENABLED: "Active", PAUSED: "Paused" }

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireSession("/dashboard")
  const q = await searchParams
  const days = ranges.find((r) => String(r.days) === q.days)?.days ?? 30
  const [loaded, leads] = await Promise.all([load(user, days), listLeads()])

  const assistant = <Assistant enabled={Boolean(process.env.ANTHROPIC_API_KEY?.trim())} />
  const noticeKey =
    q.connected === "1" ? "connected" : typeof q.ads_error === "string" ? q.ads_error : null
  const notice = noticeKey ? (notices[noticeKey] ?? notices.failed) : null

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/dashboard" user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-10">
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
            assistant={assistant}
            connection={loaded.connection}
            days={days}
            leadCount={
              leads.filter((l) => {
                const day = l.createdAt.slice(0, 10)
                return day >= loaded.report.start && day <= loaded.report.end
              }).length
            }
          />
        )}
        {loaded.kind !== "report" && assistant}
      </main>
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
  assistant,
  connection,
  days,
  leadCount,
}: {
  report: AdsReport
  searchTerms: { terms: SearchTerm[] } | { error: string }
  assistant: React.ReactNode
  connection: AdsConnection
  days: number
  leadCount: number
}) {
  const { account, totals } = report
  const money = (n: number, cents = false) => formatMoney(n, account.currency, cents)
  const wasted = findWastedSearches(
    "terms" in searchTerms ? searchTerms.terms : [],
    totals.conversions ? totals.cost / totals.conversions : 0,
  )
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
    { label: "QR code leads", value: formatNumber(leadCount), note: "from your signs and mailers" },
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
            <input type="hidden" name="days" value={days} />
            <Button type="submit" variant="outline" size="lg">
              Show
            </Button>
          </form>
        )}
        <nav aria-label="Date range" className="flex flex-wrap gap-1.5 text-sm">
          {ranges.map((r) => (
            <Link
              key={r.days}
              href={`/dashboard?days=${r.days}`}
              aria-current={r.days === days ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1",
                r.days === days
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>
        {account.test && (
          <p className="rounded-xl bg-muted p-3 text-sm">
            This is a Google Ads test account, so these numbers aren&apos;t real ad spend.
          </p>
        )}
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border bg-card p-5 shadow-xs">
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{kpi.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>
          </div>
        ))}
      </section>

      {assistant}

      <WastedSearches
        {...wasted}
        currency={account.currency}
        error={"error" in searchTerms ? searchTerms.error : undefined}
      />

      <section className="grid gap-6 rounded-2xl border bg-card p-5 shadow-xs sm:p-6 lg:grid-cols-2">
        <TrendChart
          label={`Spend per day (${account.currency})`}
          color="var(--primary)"
          data={report.daily.map((d) => ({ date: d.date, value: Math.round(d.cost * 100) / 100 }))}
        />
        <TrendChart
          label="Clicks per day"
          color="var(--chart-2, #0ea5e9)"
          data={report.daily.map((d) => ({ date: d.date, value: d.clicks }))}
        />
      </section>

      <section className="rounded-2xl border bg-card shadow-xs">
        <h2 className="px-5 pt-5 text-lg font-semibold sm:px-6">Campaigns</h2>
        {report.campaigns.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
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
              <tbody className="divide-y tabular-nums">
                {report.campaigns.map((c) => (
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
              </tbody>
            </table>
          </div>
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
