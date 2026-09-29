// The assistant's tools. Both only read data: Google Ads through GAQL SELECT queries (the search
// endpoint can't change an account), and leads from this app's own store.
import type Anthropic from "@anthropic-ai/sdk"

import { AdsApiError, runQuery } from "@/lib/google/ads"
import type { AdsAccount, AdsConnection } from "@/lib/google/connections"
import { listLeads, listQrCodes } from "@/lib/leads/store"

export const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "google_ads_query",
    description:
      "Run a read-only Google Ads Query Language (GAQL) SELECT query against the selected Google Ads account and get the rows back as JSON. " +
      "Use it for any question about spend, clicks, impressions, conversions, campaigns, ad groups, keywords, search terms, locations or devices. " +
      "Useful resources: campaign, ad_group, ad_group_criterion (keywords), keyword_view, search_term_view, geographic_view, customer. " +
      "Money fields end in _micros: divide by 1,000,000 to get the account currency. " +
      "Always filter by date with segments.date BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD' (or DURING LAST_7_DAYS / LAST_30_DAYS / THIS_MONTH / LAST_MONTH), " +
      "and add ORDER BY and a LIMIT (at most 200). JSON field names come back in camelCase, e.g. metrics.costMicros.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A complete GAQL SELECT statement." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "list_leads",
    description:
      "List the leads collected by this app's QR codes (yard signs, postcards, flyers) in the last N days, newest first. " +
      "Each lead has a date, name, phone, email, property address, notes and the QR code placement it came from. " +
      "These are separate from Google Ads conversions.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "integer", description: "How many days back to look, from 1 to 365." },
      },
      required: ["days"],
      additionalProperties: false,
    },
    strict: true,
  },
]

const MAX_ROWS = 200
const MAX_CHARS = 60_000

// Keeps tool results a sensible size for the model, and says when rows were left out.
function asResult(rows: unknown[]) {
  const kept = rows.slice(0, MAX_ROWS)
  let text = JSON.stringify({ rowCount: rows.length, rows: kept })
  if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS)}… (truncated, narrow the query)`
  else if (rows.length > kept.length) text += `\n(Only the first ${MAX_ROWS} of ${rows.length} rows are shown.)`
  return text
}

export type ToolContext = { connection: AdsConnection | null; account: AdsAccount | null }

export async function runTool(
  name: string,
  input: unknown,
  { connection, account }: ToolContext,
): Promise<{ content: string; isError?: boolean }> {
  try {
    if (name === "google_ads_query") {
      const { query } = input as { query?: unknown }
      if (typeof query !== "string") return { content: "Missing query.", isError: true }
      if (!connection || !account) {
        return { content: "Google Ads isn't connected yet, so no ad data is available.", isError: true }
      }
      return { content: asResult(await runQuery(connection, account, query)) }
    }

    if (name === "list_leads") {
      const raw = (input as { days?: unknown }).days
      const days = Math.min(Math.max(Math.round(Number(raw) || 30), 1), 365)
      const since = Date.now() - days * 86_400_000
      const [leads, qrCodes] = await Promise.all([listLeads(), listQrCodes()])
      const placements = new Map(qrCodes.map((c) => [c.id, c.placement]))
      return {
        content: asResult(
          leads
            .filter((l) => Date.parse(l.createdAt) >= since)
            .map((l) => ({
              date: l.createdAt,
              name: l.name,
              phone: l.phone,
              email: l.email,
              propertyAddress: l.propertyAddress,
              notes: l.notes,
              qrCode: placements.get(l.qrCodeId) ?? "Unknown",
            })),
        ),
      }
    }

    return { content: `Unknown tool ${name}.`, isError: true }
  } catch (error) {
    // Google's error text (e.g. a GAQL typo) helps the model fix its own query.
    const message = error instanceof AdsApiError ? error.message : "The request failed."
    return { content: message, isError: true }
  }
}
