// Feeding lead quality back to Google Ads: when the team marks a lead Interested or Closed deal,
// the app sends an offline conversion for it through Google's Data Manager API (data-manager.ts), so Google's bidding learns which clicks bring real
// sellers. Each upload is matched by the lead's Google click id (gclid, from the WordPress tracking
// snippet) and, when there is one, the lead's email and phone, scrambled with SHA-256 first
// (Google's "enhanced conversions for leads"). Google never receives the plain email or phone.
//
// The app creates its own two conversion actions the first time ("Command Center – Interested
// lead" and "Command Center – Deal closed"), as secondary conversions so they don't change bidding
// until you choose to make them primary.
import { createHash } from "node:crypto"

import { AdsApiError, postToAds, runQuery } from "@/lib/google/ads"
import { ingestEvents } from "@/lib/google/data-manager"
import type { AdsAccount, AdsConnection } from "@/lib/google/connections"
import { jsonFileStore } from "@/lib/json-file-store"
import { applyStatus } from "@/lib/leads/status"
import { listLeads, updateLead } from "@/lib/leads/store"
import type { ConversionKind, Lead, LeadStatus } from "@/lib/leads/types"

export const ACTIONS: Record<ConversionKind, { name: string; category: string }> = {
  interested: { name: "Command Center – Interested lead", category: "QUALIFIED_LEAD" },
  closed: { name: "Command Center – Deal closed", category: "CONVERTED_LEAD" },
}

const actionsFile = jsonFileStore<Record<string, Partial<Record<ConversionKind, string>>>>("conversion-actions.json", () => ({}))

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

// Google's normalizing rules: lower case, no spaces; Gmail addresses without dots before the @.
export function normalizeEmail(email: string) {
  const e = email.trim().toLowerCase()
  const [local, domain] = e.split("@")
  if (!local || !domain) return null
  return domain === "gmail.com" || domain === "googlemail.com" ? `${local.replace(/\./g, "")}@${domain}` : e
}

// E.164, e.g. +13055550100. Ten digits are taken as a US number.
export function normalizePhone(phone: string) {
  const digits = phone.replace(/[^\d]/g, "")
  if (phone.trim().startsWith("+") && digits.length >= 8) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return null
}

function identifiers(lead: Lead) {
  const ids: ({ emailAddress: string } | { phoneNumber: string })[] = []
  const email = lead.email ? normalizeEmail(lead.email) : null
  const phone = lead.phone ? normalizePhone(lead.phone) : null
  if (email) ids.push({ emailAddress: sha256(email) })
  if (phone) ids.push({ phoneNumber: sha256(phone) })
  return ids
}

// The conversion action's resource name, creating it the first time.
async function conversionAction(connection: AdsConnection, account: AdsAccount, kind: ConversionKind) {
  const cached = (await actionsFile.read())[account.customerId]?.[kind]
  if (cached) return cached
  const { name, category } = ACTIONS[kind]
  const found = (await runQuery(
    connection,
    account,
    `SELECT conversion_action.resource_name, conversion_action.name FROM conversion_action WHERE conversion_action.name = '${name}' AND conversion_action.status != 'REMOVED'`,
  )) as { conversionAction?: { resourceName?: string } }[]
  let resource = found[0]?.conversionAction?.resourceName
  if (!resource) {
    const created = await postToAds<{ results?: { resourceName?: string }[] }>(connection, account, "/conversionActions:mutate", {
      operations: [
        {
          create: {
            name,
            type: "UPLOAD_CLICKS",
            category,
            status: "ENABLED",
            countingType: "ONE_PER_CLICK",
            primaryForGoal: false,
            valueSettings: { defaultValue: 1, alwaysUseDefaultValue: true },
          },
        },
      ],
    })
    resource = created.results?.[0]?.resourceName
    if (!resource) throw new AdsApiError("Google Ads didn't create the conversion action.")
  }
  await actionsFile.update((db) => {
    db[account.customerId] = { ...db[account.customerId], [kind]: resource }
  })
  return resource
}

// Errors worth trying again later: a just-created conversion action, or a click Google hasn't
// processed yet. Anything else is reported and not retried.
const RETRY = /TOO_RECENT|CLICK_NOT_FOUND|INTERNAL|TRANSIENT|DEADLINE|UNAVAILABLE|RESOURCE_EXHAUSTED|RATE/i
const SETUP_RETRY_MS = 5 * 60_000
// Refused by the old upload Google closed to new apps: send these again the new way.
const OLD_UPLOAD_CLOSED = /Data Manager API|ConversionUploadService|limited to existing users/i
const MAX_TRIES = 12
const RETRY_AFTER_MS = 60 * 60_000

async function upload(connection: AdsConnection, account: AdsAccount, lead: Lead, kind: ConversionKind) {
  const entry = lead.conversions?.[kind]
  if (!entry) return
  const gclid = lead.tracking?.gclid
  const ids = identifiers(lead)
  if (!gclid && !ids.length) {
    await updateLead(lead.id, (l) => {
      l.conversions![kind] = { ...entry, state: "skipped", error: "No Google click ID, email or phone to match it with." }
    })
    return
  }
  let error: string | undefined
  let code = ""
  try {
    const action = await conversionAction(connection, account, kind)
    await ingestEvents(connection, account, action.split("/").pop()!, [
      {
        eventTimestamp: new Date(entry.at).toISOString(),
        // The same lead and stage is only ever counted once, even if sent again.
        transactionId: `${lead.id}-${kind}`,
        eventSource: "WEB",
        ...(gclid ? { adIdentifiers: { gclid } } : {}),
        ...(ids.length ? { userData: { userIdentifiers: ids } } : {}),
        conversionValue: 1,
        currency: account.currency || "USD",
      },
    ])
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    code = e instanceof AdsApiError ? (e.code ?? "") : ""
  }
  const now = new Date().toISOString()
  await updateLead(lead.id, (l) => {
    const tries = (entry.tries ?? 0) + 1
    // Waiting on a set-up step (a permission, the API turned on): keep it waiting, without
    // counting tries, and check again every few minutes.
    const waitingFor = code === "NEEDS_PERMISSION" ? "permission" : code === "API_OFF" ? "api" : undefined
    l.conversions![kind] = error
      ? {
          ...entry,
          tries: waitingFor ? (entry.tries ?? 0) : tries,
          lastTry: now,
          error,
          waitingFor,
          state: waitingFor || (RETRY.test(`${code} ${error}`) && tries < MAX_TRIES) ? "pending" : "failed",
        }
      : { at: entry.at, tries, lastTry: now, state: "sent", matchedBy: [gclid && "Google click ID", ids.length && "email/phone"].filter(Boolean).join(" + ") }
  })
}

// Sets a lead's status (chosen by you) and queues the conversions it means; they're sent right
// away when Google Ads is connected, and retried later if Google isn't ready for them yet.
export async function setLeadStatus(id: string, status: LeadStatus) {
  return updateLead(id, (lead) => applyStatus(lead, status, "you"))
}

// Sends every conversion waiting to go: new ones at once, retries at most hourly.
let running: Promise<void> | null = null
export function sendPendingConversions(connection: AdsConnection, account: AdsAccount) {
  running ??= (async () => {
    const leads = await listLeads()
    for (const lead of leads) {
      for (const kind of ["interested", "closed"] as const) {
        let entry = lead.conversions?.[kind]
        if (entry?.state === "failed" && OLD_UPLOAD_CLOSED.test(entry.error ?? "")) {
          await updateLead(lead.id, (l) => {
            l.conversions![kind] = { state: "pending", at: entry!.at }
          })
          lead.conversions![kind] = entry = { state: "pending", at: entry.at }
        }
        if (entry?.state !== "pending") continue
        const wait = entry.waitingFor ? SETUP_RETRY_MS : RETRY_AFTER_MS
        if (entry.lastTry && Date.now() - Date.parse(entry.lastTry) < wait) continue
        await upload(connection, account, lead, kind)
      }
    }
  })().finally(() => {
    running = null
  })
  return running
}
