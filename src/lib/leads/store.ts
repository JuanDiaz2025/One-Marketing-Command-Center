// QR codes and the leads they collect, saved in .data/leads.json (not committed).
// Swap these functions for database calls to go to production.
import { randomBytes } from "node:crypto"

import { jsonFileStore } from "@/lib/json-file-store"
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

export async function addLead(input: Omit<Lead, "id" | "createdAt">) {
  return file.update((db) => {
    const lead: Lead = { ...input, id: newId(), createdAt: new Date().toISOString() }
    db.leads.push(lead)
    return lead
  })
}
