// QR codes and the leads they collect, saved in .data/leads.json (not committed).
// Swap these functions for database calls to go to production.
import { randomBytes } from "node:crypto"

import { jsonFileStore } from "@/lib/json-file-store"
import { getScoringSettings, scoreLead } from "@/lib/leads/scoring"
import { applyStatus } from "@/lib/leads/status"
import type { Lead, QrCode } from "@/lib/leads/types"

type Db = { qrCodes: QrCode[]; leads: Lead[] }

const file = jsonFileStore<Db>("leads.json", () => ({ qrCodes: [], leads: [] }))

export const newId = () =>
  randomBytes(6)
    .toString("base64url")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8)
    .padEnd(8, "0")

export async function listQrCodes() {
  const db = await file.read()
  return [...db.qrCodes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getQrCode(id: string) {
  const db = await file.read()
  return db.qrCodes.find((c) => c.id === id) ?? null
}

export async function createQrCode(input: Omit<QrCode, "id" | "createdAt" | "active">) {
  return file.update((db) => {
    const code: QrCode = { ...input, id: newId(), active: true, createdAt: new Date().toISOString() }
    db.qrCodes.push(code)
    return code
  })
}

export async function updateQrCode(id: string, patch: Partial<Omit<QrCode, "id" | "createdAt">>) {
  return file.update((db) => {
    const code = db.qrCodes.find((c) => c.id === id)
    if (!code) return null
    Object.assign(code, patch)
    return code
  })
}

// Newest first.
export async function listLeads() {
  const db = await file.read()
  return [...db.leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

const digits = (s?: string) => s?.replace(/\D/g, "").slice(-10) || undefined
const SAME_LEAD_MS = 15 * 60_000
// "wp:www.example.com:12" and "wp:example.com:12" are the same saved lead.
const sameSource = (a?: string, b?: string) => Boolean(a && b && a.replace(/^wp:www\./, "wp:") === b.replace(/^wp:www\./, "wp:"))

// `createdAt` defaults to now; leads picked up from WordPress keep the time they were really sent.
// The same lead can arrive twice when the website uses both the Lead Saver plugin and a webhook:
// one with an email or phone in common from within 15 minutes of the other, where only one of
// them came from the plugin, is taken to be the same lead. A plugin lead is added once (by its id).
// Every new lead is scored on arrival; with automatic status on (the default), a Hot lead is
// marked Interested (Google Ads hears about it) and a Junk one Not interested.
export async function addLead(input: Omit<Lead, "id" | "createdAt">, createdAt?: string) {
  const { autoStatus } = await getScoringSettings()
  return file.update((db) => {
    const at = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString()
    if (input.inboxId) {
      const known = db.leads.find((l) => sameSource(l.inboxId, input.inboxId))
      if (known) return known
    }
    const email = input.email?.toLowerCase()
    const phone = digits(input.phone)
    const same = db.leads.find(
      (l) =>
        !l.qrCodeId &&
        Boolean(l.inboxId) !== Boolean(input.inboxId) &&
        Math.abs(Date.parse(l.createdAt) - Date.parse(at)) < SAME_LEAD_MS &&
        ((email && l.email?.toLowerCase() === email) || (phone && digits(l.phone) === phone)),
    )
    if (same) {
      same.inboxId ??= input.inboxId
      return same
    }
    const lead: Lead = { ...input, id: newId(), createdAt: at }
    lead.score = scoreLead(lead, db.leads)
    if (autoStatus && !lead.status && !lead.qrCodeId) {
      if (lead.score.grade === "hot") applyStatus(lead, "interested", "auto")
      else if (lead.score.grade === "junk") applyStatus(lead, "not_interested", "auto")
    }
    db.leads.push(lead)
    return lead
  })
}

// Changes one lead in place (status, conversion uploads). Returns the updated lead, or null.
export async function updateLead(id: string, change: (lead: Lead) => void) {
  return file.update((db) => {
    const lead = db.leads.find((l) => l.id === id)
    if (!lead) return null
    change(lead)
    return lead
  })
}

// Scores leads that came in before scoring existed. Their status is left alone, so nothing old
// is sent to Google Ads without you choosing it.
export async function scoreUnscored() {
  const db = await file.read()
  if (db.leads.every((l) => l.score)) return
  await file.update((db) => {
    const byDate = [...db.leads].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    byDate.forEach((lead, i) => {
      lead.score ??= scoreLead(lead, byDate.slice(0, i))
    })
  })
}
