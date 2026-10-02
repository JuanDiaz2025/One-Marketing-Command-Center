// Google Ads API (REST) with the person's own OAuth token.
// Reference: https://developers.google.com/google-ads/api/rest/overview
import { adsConfig } from "@/lib/auth/config"
import type { AdsAccount, AdsConnection } from "@/lib/google/connections"
import { OAuthError, refreshAccessToken } from "@/lib/google/oauth"
import type { Period } from "@/lib/google/period"

export class AdsApiError extends Error {
  // Set when Google couldn't find the account or item asked for (worth trying another way).
  notFound = false
  // Set when Google refused that way in (no permission): also worth trying another way.
  denied = false
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
  }
}

// Access tokens last an hour; keep them in memory rather than refreshing on every request.
const accessTokens = new Map<string, { token: string; expires: number }>()

export async function accessToken(connection: AdsConnection) {
  const cached = accessTokens.get(connection.refreshToken)
  if (cached && cached.expires > Date.now() + 60_000) return cached.token
  try {
    const res = await refreshAccessToken(connection.refreshToken)
    accessTokens.set(connection.refreshToken, {
      token: res.access_token,
      expires: Date.now() + res.expires_in * 1000,
    })
    return res.access_token
  } catch (error) {
    if (error instanceof OAuthError && error.code === "invalid_grant") {
      throw new AdsApiError(
        "Google Ads access has expired or was removed. Connect Google Ads again.",
        "RECONNECT",
      )
    }
    throw error
  }
}

// Google Ads puts the useful reason a few levels down in its error body.
function describeError(body: unknown, status: number) {
  const error = (body as { error?: { message?: string; details?: unknown[] } })?.error
  for (const detail of error?.details ?? []) {
    const first = (detail as { errors?: { message?: string; errorCode?: Record<string, string> }[] })
      ?.errors?.[0]
    if (first?.message) {
      const code = first.errorCode ? Object.values(first.errorCode)[0] : undefined
      return new AdsApiError(first.message, code)
    }
  }
  return new AdsApiError(error?.message ?? `Google Ads returned an error (${status}).`)
}

async function request<T>(
  connection: AdsConnection,
  path: string,
  init: { body?: unknown; loginCustomerId?: string } = {},
): Promise<T> {
  const { developerToken, apiVersion } = adsConfig()
  const res = await fetch(`https://googleads.googleapis.com/${apiVersion}/${path}`, {
    method: init.body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${await accessToken(connection)}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
      ...(init.loginCustomerId ? { "login-customer-id": init.loginCustomerId } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw describeError(body, res.status)
  return body as T
}

// Runs a Google Ads Query Language (GAQL) query and returns every row.
async function search<Row>(
  connection: AdsConnection,
  customerId: string,
  query: string,
  loginCustomerId?: string,
) {
  const rows: Row[] = []
  let pageToken: string | undefined
  do {
    const page = await request<{ results?: Row[]; nextPageToken?: string }>(
      connection,
      `customers/${customerId}/googleAds:search`,
      { body: { query, ...(pageToken ? { pageToken } : {}) }, loginCustomerId },
    )
    rows.push(...(page.results ?? []))
    pageToken = page.nextPageToken
  } while (pageToken)
  return rows
}

type CustomerRow = {
  customer: {
    id: string
    descriptiveName?: string
    manager?: boolean
    currencyCode?: string
    testAccount?: boolean
  }
}

type ClientRow = {
  customerClient: {
    id: string
    descriptiveName?: string
    manager?: boolean
    currencyCode?: string
    testAccount?: boolean
  }
}

// Every account the person can report on: the ones they were invited to directly, plus the
// accounts under any manager account they have.
export async function listAccounts(connection: AdsConnection): Promise<AdsAccount[]> {
  const { resourceNames = [] } = await request<{ resourceNames?: string[] }>(
    connection,
    "customers:listAccessibleCustomers",
  )
  const accounts = new Map<string, AdsAccount>()
  const failures: unknown[] = []

  for (const id of resourceNames.map((r) => r.split("/")[1])) {
    try {
      const [row] = await search<CustomerRow>(
        connection,
        id,
        "SELECT customer.id, customer.descriptive_name, customer.manager, customer.currency_code, customer.test_account FROM customer LIMIT 1",
      )
      if (!row) continue
      const c = row.customer
      if (!c.manager) {
        accounts.set(c.id, {
          customerId: c.id,
          name: c.descriptiveName || formatCustomerId(c.id),
          currency: c.currencyCode ?? "USD",
          test: Boolean(c.testAccount),
        })
        continue
      }
      const clients = await search<ClientRow>(
        connection,
        id,
        "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.currency_code, customer_client.test_account FROM customer_client WHERE customer_client.manager = FALSE AND customer_client.status = 'ENABLED'",
        id,
      )
      for (const { customerClient: cc } of clients) {
        if (accounts.has(cc.id)) continue
        accounts.set(cc.id, {
          customerId: cc.id,
          name: cc.descriptiveName || formatCustomerId(cc.id),
          currency: cc.currencyCode ?? "USD",
          loginCustomerId: id,
          managerName: c.descriptiveName || formatCustomerId(id),
          test: Boolean(cc.testAccount),
        })
      }
    } catch (error) {
      // Cancelled or suspended accounts can't be queried; skip them, but don't hide a problem
      // that affects every account (like an unapproved developer token).
      failures.push(error)
    }
  }

  if (!accounts.size && failures.length) throw failures[0]
  return [...accounts.values()].sort(byPreference)
}

export const formatCustomerId = (id: string) => id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")

// Real accounts before test accounts, and accounts with a name (like "Twin Home Buyer") before
// unnamed ones that only show their number, so the app opens on the business's main account.
const unnamed = (a: AdsAccount) => a.name === formatCustomerId(a.customerId) || /^\d[\d-]*$/.test(a.name)
function byPreference(a: AdsAccount, b: AdsAccount) {
  return Number(a.test) - Number(b.test) || Number(unnamed(a)) - Number(unnamed(b)) || a.name.localeCompare(b.name)
}

// The account you picked on the Google Ads page, or else the best guess at your main one.
export function chosenAccount(accounts: AdsAccount[], selectedCustomerId?: string) {
  return accounts.find((a) => a.customerId === selectedCustomerId) ?? [...accounts].sort(byPreference)[0]
}

export type Metrics = {
  cost: number
  impressions: number
  clicks: number
  conversions: number
  conversionValue: number
}

export type CampaignReport = Metrics & {
  id: string
  name: string
  status: string
  channel: string
}

export type AdsReport = {
  account: AdsAccount
  start: string
  end: string
  totals: Metrics
  daily: (Metrics & { date: string })[]
  campaigns: CampaignReport[]
}

type MetricsJson = {
  costMicros?: string
  impressions?: string
  clicks?: string
  conversions?: number
  conversionsValue?: number
}

// int64 fields arrive as strings; money is in millionths of the account's currency.
const toMetrics = (m: MetricsJson = {}): Metrics => ({
  cost: Number(m.costMicros ?? 0) / 1_000_000,
  impressions: Number(m.impressions ?? 0),
  clicks: Number(m.clicks ?? 0),
  conversions: Number(m.conversions ?? 0),
  conversionValue: Number(m.conversionsValue ?? 0),
})

export const emptyMetrics = (): Metrics => ({
  cost: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  conversionValue: 0,
})

export function addMetrics(a: Metrics, b: Metrics): Metrics {
  return {
    cost: a.cost + b.cost,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    conversions: a.conversions + b.conversions,
    conversionValue: a.conversionValue + b.conversionValue,
  }
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

function everyDay(start: string, end: string) {
  const days: string[] = []
  for (let d = new Date(`${start}T00:00:00Z`); isoDay(d) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(isoDay(d))
  }
  return days
}

const METRIC_FIELDS =
  "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value"

export async function getReport(
  connection: AdsConnection,
  account: AdsAccount,
  period: Period,
): Promise<AdsReport> {
  const { end } = period
  const during = `segments.date BETWEEN '${period.start}' AND '${end}'`
  const { customerId, loginCustomerId } = account

  const [campaignRows, dailyRows] = await Promise.all([
    search<{
      campaign: { id: string; name: string; status: string; advertisingChannelType?: string }
      metrics?: MetricsJson
    }>(
      connection,
      customerId,
      `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, ${METRIC_FIELDS} FROM campaign WHERE ${during} AND campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC`,
      loginCustomerId,
    ),
    search<{ segments: { date: string }; metrics?: MetricsJson }>(
      connection,
      customerId,
      `SELECT segments.date, ${METRIC_FIELDS} FROM customer WHERE ${during}`,
      loginCustomerId,
    ),
  ])

  const byDate = new Map(dailyRows.map((r) => [r.segments.date, toMetrics(r.metrics)]))
  // "All time" starts on the first day the account had any activity.
  const start =
    period.preset === "all"
      ? (dailyRows.map((r) => r.segments.date).sort()[0] ?? end)
      : period.start
  const daily = everyDay(start, end).map((date) => ({
    date,
    ...(byDate.get(date) ?? emptyMetrics()),
  }))

  return {
    account,
    start,
    end,
    totals: daily.reduce<Metrics>(addMetrics, emptyMetrics()),
    daily,
    campaigns: campaignRows.map((r) => ({
      id: r.campaign.id,
      name: r.campaign.name,
      status: r.campaign.status,
      channel: r.campaign.advertisingChannelType ?? "",
      ...toMetrics(r.metrics),
    })),
  }
}

export type SearchTerm = Metrics & {
  term: string
  campaign: string
  adGroup: string
  status: string
}

// Search terms people typed before clicking an ad, excluding ones already blocked with a negative
// keyword. Performance Max terms aren't included: Google doesn't report them here.
export async function getSearchTerms(
  connection: AdsConnection,
  account: AdsAccount,
  { start, end }: Period,
): Promise<SearchTerm[]> {
  const rows = await search<{
    searchTermView: { searchTerm: string; status?: string }
    campaign: { name: string }
    adGroup: { name: string }
    metrics?: MetricsJson
  }>(
    connection,
    account.customerId,
    `SELECT search_term_view.search_term, search_term_view.status, campaign.name, ad_group.name, ${METRIC_FIELDS} FROM search_term_view WHERE segments.date BETWEEN '${start}' AND '${end}' AND metrics.cost_micros > 0 ORDER BY metrics.cost_micros DESC LIMIT 1000`,
    account.loginCustomerId,
  )
  return rows
    .map((r) => ({
      term: r.searchTermView.searchTerm,
      status: r.searchTermView.status ?? "NONE",
      campaign: r.campaign.name,
      adGroup: r.adGroup.name,
      ...toMetrics(r.metrics),
    }))
    .filter((t) => t.status !== "EXCLUDED" && t.status !== "ADDED_EXCLUDED")
}

// Runs a read-only GAQL query for the chat assistant. The search endpoint can't change anything
// in the account; this also refuses anything that isn't a SELECT.
export async function runQuery(connection: AdsConnection, account: AdsAccount, query: string) {
  if (!/^\s*select\s/i.test(query)) throw new AdsApiError("Only SELECT queries are allowed.")
  return search<Record<string, unknown>>(connection, account.customerId, query, account.loginCustomerId)
}

// A change in the account (the only ones this app makes: creating its two conversion actions and
// uploading offline conversions for leads marked interested or closed). `suffix` follows the
// customer, e.g. "/conversionActions:mutate" or ":uploadClickConversions".
export async function postToAds<T>(connection: AdsConnection, account: AdsAccount, suffix: string, body: unknown) {
  return request<T>(connection, `customers/${account.customerId}${suffix}`, { body, loginCustomerId: account.loginCustomerId })
}
