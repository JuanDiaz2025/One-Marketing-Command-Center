// Conversion storage. For the demo this is a JSON file on the server (.data/conversions.json),
// seeded from mock-data.ts. Swap these functions for database calls to go to production.
import { randomBytes } from "node:crypto"

import { mockConversions, mockQrCodes } from "@/lib/conversions/mock-data"
import type { Conversion, QrCode } from "@/lib/conversions/types"
import { jsonFileStore } from "@/lib/json-file-store"

type Db = { qrCodes: QrCode[]; conversions: Conversion[] }

const file = jsonFileStore<Db>("conversions.json", () => ({
  qrCodes: structuredClone(mockQrCodes),
  conversions: structuredClone(mockConversions),
}))

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
  const db = await file.read()
  const code: QrCode = { ...input, id: newId(), active: true, createdAt: new Date().toISOString() }
  db.qrCodes.push(code)
  await file.write(db)
  return code
}

export async function updateQrCode(id: string, patch: Partial<Omit<QrCode, "id" | "createdAt">>) {
  const db = await file.read()
  const code = db.qrCodes.find((c) => c.id === id)
  if (!code) return null
  Object.assign(code, patch)
  await file.write(db)
  return code
}

export async function listConversions() {
  const db = await file.read()
  return db.conversions
}

export async function addConversion(input: Omit<Conversion, "id" | "createdAt">) {
  const db = await file.read()
  const conversion: Conversion = { ...input, id: newId(), createdAt: new Date().toISOString() }
  db.conversions.push(conversion)
  await file.write(db)
  return conversion
}
