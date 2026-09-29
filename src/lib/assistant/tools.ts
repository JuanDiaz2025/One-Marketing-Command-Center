// The assistant's tools. Both only read data: Google Ads through GAQL SELECT queries (the search
// endpoint can't change an account), and leads from this app's own store.
import { AdsApiError, runQuery } from "@/lib/google/ads"
import type { AdsAccount, AdsConnection } from "@/lib/google/connections"
import { leadSource } from "@/lib/leads/source"
import { listLeads, listQrCodes } from "@/lib/leads/store"

// Written once and handed to whichever AI provider is set up (see claude.ts and openai.ts).
export type ToolSpec = {
  name: string
  description: string
  parameters: { type: "object"; properties: Record<string, unknown>; required: string[]; additionalProperties: false }
}

export const toolSpecs: ToolSpec[] = [
  {
    name: "google_ads_query",
    description:
      "Run a read-only Google Ads Query Language (GAQL) SELECT query against the selected Google Ads account and get the rows back as JSON. " +
      "Use it for any question about spend, clicks, impressions, conversions, campaigns, ad groups, keywords, search terms, locations or devices. " +
      "Useful resources: campaign, ad_group, ad_group_criterion (keywords), keyword_view, search_term_view, geographic_view, customer. " +
      "For locations: user_location_view with segments.geo_target_city and user_location_view.targeting_location (false = outside the target area), " +
      "campaign_criterion WHERE campaign_criterion.type = 'LOCATION' for targeting, campaign.geo_target_type_setting.positive_geo_target_type for Presence vs Presence or interest, " +
      "and geo_target_constant (resource_name IN (...)) to turn geoTargetConstants/123 into place names. " +
      "Money fields end in _micros: divide by 1,000,000 to get the account currency. " +
      "Always filter by date with segments.date BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD' (or DURING LAST_7_DAYS / LAST_30_DAYS / THIS_MONTH / LAST_MONTH), " +
      "and add ORDER BY and a LIMIT (at most 200). JSON field names come back in camelCase, e.g. metrics.costMicros.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "A complete GAQL SELECT statement." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_leads",
    description:
      "List the leads collected in the last N days, newest first: from this app's QR codes (yard signs, postcards, flyers) and from the WordPress website's forms. " +
      "Each lead has a date, name, phone, email, property address, notes and its source (the QR code placement, or the website form). " +
      "These are separate from Google Ads conversions.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "integer", description: "How many days back to look, from 1 to 365." },
      },
      required: ["days"],
      additionalProperties: false,
    },
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
              source: leadSource(l, placements),
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
