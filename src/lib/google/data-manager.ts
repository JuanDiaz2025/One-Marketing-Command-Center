// Google's Data Manager API, which Google now requires for sending offline conversions (the
// Google Ads API's uploadClickConversions is closed to new apps). It needs the "datamanager"
// permission when connecting Google Ads, and the Data Manager API turned on in the Google Cloud
// project the app's sign-in client belongs to. No developer token is needed.
import { accessToken, AdsApiError } from "@/lib/google/ads"
import type { AdsAccount, AdsConnection } from "@/lib/google/connections"

export const DATA_MANAGER_LIBRARY = "https://console.cloud.google.com/apis/library/datamanager.googleapis.com"

export type DataManagerEvent = {
  eventTimestamp: string // ISO 8601
  transactionId?: string
  eventSource: "WEB" | "CALL"
  adIdentifiers?: { gclid: string }
  userData?: { userIdentifiers: ({ emailAddress: string } | { phoneNumber: string })[] }
  conversionValue?: number
  currency?: string
}

type ErrorBody = {
  error?: {
    code?: number
    message?: string
    status?: string
    details?: {
      reason?: string
      metadata?: Record<string, string>
      links?: { description?: string; url?: string }[]
      fieldViolations?: { field?: string; description?: string; reason?: string }[]
    }[]
  }
}

// Sends events for one conversion action. Throws AdsApiError with a code saying what to do:
// NEEDS_PERMISSION (connect Google Ads again), API_OFF (turn on the API), TRANSIENT, or none.
// `validateOnly` asks Google to check the request without counting anything (for the Leads page's check).
export async function ingestEvents(
  connection: AdsConnection,
  account: AdsAccount,
  conversionActionId: string,
  events: DataManagerEvent[],
  validateOnly = false,
) {
  const destination = {
    operatingAccount: { accountType: "GOOGLE_ADS", accountId: account.customerId },
    ...(account.loginCustomerId && account.loginCustomerId !== account.customerId
      ? { loginAccount: { accountType: "GOOGLE_ADS", accountId: account.loginCustomerId } }
      : {}),
    productDestinationId: conversionActionId,
  }
  const res = await fetch("https://datamanager.googleapis.com/v1/events:ingest", {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(connection)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ destinations: [destination], encoding: "HEX", events, ...(validateOnly ? { validateOnly: true } : {}) }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  })
  if (res.ok) return (await res.json().catch(() => ({}))) as { requestId?: string }

  const body = ((await res.json().catch(() => null)) ?? {}) as ErrorBody
  const e = body.error ?? {}
  const reasons = (e.details ?? []).map((d) => d.reason ?? "").join(" ")
  const message = e.message ?? `Google answered ${res.status}.`
  if (/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes/i.test(`${reasons} ${message}`)) {
    throw new AdsApiError(
      "Google needs one more permission to receive conversions. Open the Google Ads page in the app and click Connect Google Ads again, and allow everything it asks.",
      "NEEDS_PERMISSION",
    )
  }
  // The API is off for the Google Cloud project that owns the app's sign-in client. Google names
  // that project and links straight to its switch: show both, since the usual cause is the API
  // being turned on in a different project.
  if (/SERVICE_DISABLED|accessNotConfigured/i.test(reasons) || /API has not been used|API .*is disabled|accessNotConfigured/i.test(message)) {
    const meta = Object.assign({}, ...(e.details ?? []).map((d) => d.metadata ?? {})) as Record<string, string>
    const link =
      meta.activationUrl ??
      (e.details ?? []).flatMap((d) => d.links ?? []).find((l) => l.url?.includes("console"))?.url ??
      DATA_MANAGER_LIBRARY
    const project = meta.consumer?.replace(/^projects\//, "") ?? message.match(/project (\d+)/)?.[1]
    throw new AdsApiError(
      `Google says the Data Manager API is off${project ? ` in Google Cloud project ${project}` : ""}, the project your app's Google sign-in belongs to. Turn it on here: ${link} . If you already turned it on, it was probably in a different project; it has to be this one. Then wait 5 minutes and click Try again now. (Google's words: “${message}”)`,
      "API_OFF",
    )
  }
  if (res.status === 429 || res.status >= 500) throw new AdsApiError(message, "TRANSIENT")
  const violation = e.details?.flatMap((d) => d.fieldViolations ?? [])[0]
  throw new AdsApiError(violation?.description ? `${message} ${violation.description}` : message, e.status)
}
