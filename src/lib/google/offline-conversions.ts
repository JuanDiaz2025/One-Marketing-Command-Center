// Feeding lead quality back to Google Ads: when the team marks a lead Interested or Closed deal,
// the app sends an offline conversion for it through Google's Data Manager API (data-manager.ts), so Google's bidding learns which clicks bring real
// sellers. Each upload is matched by the lead's Google click id (gclid, from the WordPress tracking
// snippet) and, when there is one, the lead's email and phone, scrambled with SHA-256 first
// (Google's "enhanced conversions for leads"). Google never receives the plain email or phone.
//
// Each stage goes to a conversion action in the account: your own "Qualified lead" and "Converted
// lead" actions when there are ones that accept imports (found by name, then by category), or
// one you pick on the Leads page. Only when there's none does the app create its own
// ("Command Center – Interested lead" / "– Deal closed"), as secondary conversions.
import { createHash } from "node:crypto"

import { AdsApiError, postToAds, runQuery } from "@/lib/google/ads"
import { ingestEvents } from "@/lib/google/data-manager"
import type { AdsAccount, AdsConnection } from "@/lib/google/connections"
import { jsonFileStore } from "@/lib/json-file-store"
import { applyStatus } from "@/lib/leads/status"
import { listLeads, updateLead } from "@/lib/leads/store"
import type { ConversionKind, Lead, LeadStatus } from "@/lib/leads/types"

// The actions the app makes when the account has none that accept imported leads.
export const ACTIONS: Record<ConversionKind, { name: string; category: string; legacy: string }> = {
  interested: { name: "Qualified lead (Command Center import)", category: "QUALIFIED_LEAD", legacy: "Command Center – Interested lead" },
  closed: { name: "Converted lead (Command Center import)", category: "CONVERTED_LEAD", legacy: "Command Center – Deal closed" },
}

// Per account: the conversion action each stage goes to, and whether you picked it yourself.
type Targets = { interested?: string; closed?: string; chosen?: Partial<Record<ConversionKind, boolean>>; checkedAt?: string; v?: 2 }
const actionsFile = jsonFileStore<Record<string, Targets>>("conversion-actions.json", () => ({}))
const RECHECK_MS = 24 * 60 * 60_000

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

export type ConversionActionOption = { resourceName: string; name: string; category: string; type: string; importable: boolean }

// The account's enabled conversion actions. Only "import from clicks" ones can receive leads.
export async function listConversionActions(connection: AdsConnection, account: AdsAccount): Promise<ConversionActionOption[]> {
  const rows = (await runQuery(
    connection,
    account,
    "SELECT conversion_action.resource_name, conversion_action.name, conversion_action.category, conversion_action.type FROM conversion_action WHERE conversion_action.status = 'ENABLED'",
  )) as { conversionAction?: { resourceName?: string; name?: string; category?: string; type?: string } }[]
  return rows
    .map((r) => r.conversionAction ?? {})
    .filter((a): a is Required<typeof a> => Boolean(a.resourceName && a.name))
    .map((a) => ({ resourceName: a.resourceName, name: a.name, category: a.category ?? "", type: a.type ?? "", importable: a.type === "UPLOAD_CLICKS" }))
    .sort((x, y) => x.name.localeCompare(y.name))
}

// Your own action for a stage: by name first ("Qualified lead" / "Converted lead"), then by
// Google's category; the app's own actions only if there's nothing else.
const NAMES: Record<ConversionKind, RegExp> = { interested: /qualified\s*lead/i, closed: /convert(ed)?\s*lead|closed?\s*(deal|lead)|deal\s*closed/i }
const isOurs = (o: ConversionActionOption) => o.name.includes("Command Center")
function pick(options: ConversionActionOption[], kind: ConversionKind) {
  const ok = options.filter((o) => o.importable && !isOurs(o))
  return (
    ok.find((o) => NAMES[kind].test(o.name)) ??
    ok.find((o) => o.category === ACTIONS[kind].category) ??
    options.find((o) => o.importable && (o.name === ACTIONS[kind].name || o.name === ACTIONS[kind].legacy))
  )
}

// Which action each stage goes to, looking them up (again once a day, for stages you didn't pick).
export async function conversionTargets(connection: AdsConnection, account: AdsAccount) {
  const options = await listConversionActions(connection, account)
  let saved = (await actionsFile.read())[account.customerId] ?? {}
  const stale = saved.v !== 2 || !saved.checkedAt || Date.now() - Date.parse(saved.checkedAt) > RECHECK_MS
  const gone = (r?: string) => Boolean(r && !options.some((o) => o.resourceName === r))
  if (stale || gone(saved.interested) || gone(saved.closed)) {
    saved = await actionsFile.update((db) => {
      const t: Targets = { ...db[account.customerId], v: 2, checkedAt: new Date().toISOString() }
      t.chosen ??= {}
      for (const kind of ["interested", "closed"] as const) {
        if (t.chosen[kind] && !gone(t[kind])) continue
        t.chosen[kind] = false
        t[kind] = pick(options, kind)?.resourceName
      }
      db[account.customerId] = t
      return t
    })
  }
  const named = (r?: string) => options.find((o) => o.resourceName === r)
  // Your own action by that name exists but can't receive imported leads (e.g. it counts a website form).
  const blocked = (kind: ConversionKind) => options.find((o) => !o.importable && !isOurs(o) && NAMES[kind].test(o.name))?.name
  return {
    blocked: { interested: blocked("interested"), closed: blocked("closed") },
    options,
    interested: named(saved.interested),
    closed: named(saved.closed),
    chosen: saved.chosen ?? {},
  }
}

// You pick the action for a stage on the Leads page; it stays until you change it.
export async function setConversionTarget(connection: AdsConnection, account: AdsAccount, kind: ConversionKind, resourceName: string) {
  const options = await listConversionActions(connection, account)
  if (!options.some((o) => o.resourceName === resourceName && o.importable)) {
    throw new AdsApiError("That conversion action can't receive imported leads. Pick one whose source is \"Import from clicks\".")
  }
  await actionsFile.update((db) => {
    const t: Targets = { ...db[account.customerId], v: 2, checkedAt: db[account.customerId]?.checkedAt ?? new Date().toISOString() }
    t[kind] = resourceName
    t.chosen = { ...t.chosen, [kind]: true }
    db[account.customerId] = t
  })
}

// The conversion action a stage is sent to, creating the app's own one only if the account has
// nothing that fits.
async function conversionAction(connection: AdsConnection, account: AdsAccount, kind: ConversionKind) {
  const saved = (await actionsFile.read())[account.customerId]
  const fresh = saved?.v === 2 && saved.checkedAt && Date.now() - Date.parse(saved.checkedAt) < RECHECK_MS
  if (fresh && saved[kind]) return saved[kind]!
  const targets = await conversionTargets(connection, account)
  const target = targets[kind]?.resourceName
  if (target) return target
  const { name, category } = ACTIONS[kind]
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
          // The value comes with each lead (your rules' value, or 1).
          valueSettings: { defaultValue: 1, alwaysUseDefaultValue: false },
        },
      },
    ],
  })
  const resource = created.results?.[0]?.resourceName
  if (!resource) throw new AdsApiError("Google Ads didn't create the conversion action.")
  await actionsFile.update((db) => {
    db[account.customerId] = { ...db[account.customerId], [kind]: resource, v: 2, checkedAt: new Date().toISOString() }
  })
  return resource
}

// Errors worth trying again later: a just-created conversion action, or a click Google hasn't
// processed yet. Anything else is reported and not retried.
const RETRY = /TOO_RECENT|CLICK_NOT_FOUND|INTERNAL|TRANSIENT|DEADLINE|UNAVAILABLE|RESOURCE_EXHAUSTED|RATE/i
const SETUP_RETRY_MS = 5 * 60_000
// Refused by the old upload Google closed to new apps: send these again the new way.
const OLD_UPLOAD_CLOSED = /ConversionUploadService|limited to existing users/i
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
        conversionValue: entry.value ?? 1,
        currency: account.currency || "USD",
      },
    ])
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    code = e instanceof AdsApiError ? (e.code ?? "") : ""
  }
  const now = new Date().toISOString()
  await updateLead(lead.id, (l) => {
    // Work from the lead as saved now: the status may have changed while this was being sent.
    const current = l.conversions?.[kind]
    if (!current || current.state !== "pending") return
    if (current.at !== entry.at) return // set again meanwhile: the next run sends the new one
    const tries = (current.tries ?? 0) + 1
    // Waiting on a set-up step (a permission, the API turned on): keep it waiting, without
    // counting tries, and check again every few minutes.
    const waitingFor = code === "NEEDS_PERMISSION" ? "permission" : code === "API_OFF" ? "api" : undefined
    l.conversions![kind] = error
      ? {
          ...current,
          tries: waitingFor ? (current.tries ?? 0) : tries,
          lastTry: now,
          error,
          waitingFor,
          state: waitingFor || (RETRY.test(`${code} ${error}`) && tries < MAX_TRIES) ? "pending" : "failed",
        }
      : { at: current.at, value: current.value, rule: current.rule, tries, lastTry: now, state: "sent", matchedBy: [gclid && "Google click ID", ids.length && "email/phone"].filter(Boolean).join(" + ") }
  })
}

// Sets a lead's status (chosen by you) and queues the conversions it means; they're sent right
// away when Google Ads is connected, and retried later if Google isn't ready for them yet.
export async function setLeadStatus(id: string, status: LeadStatus) {
  return updateLead(id, (lead) => applyStatus(lead, status, "you"))
}

// Sends every conversion waiting to go: new ones at once, retries at most hourly.
let running: Promise<void> | null = null
let again = false
export function sendPendingConversions(connection: AdsConnection, account: AdsAccount): Promise<void> {
  // Asked again while a run is going (e.g. a status was just changed): go once more after it,
  // so the new conversion isn't left for the next page load.
  if (running) {
    again = true
    return running
  }
  running = (async () => {
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
    if (again) {
      again = false
      void sendPendingConversions(connection, account).catch((error) => console.error("Couldn't send conversions to Google Ads:", error))
    }
  })
  return running
}
