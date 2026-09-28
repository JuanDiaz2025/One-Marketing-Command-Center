// Pure helpers that turn conversions into stats. No storage access here.
import type { Conversion } from "@/lib/conversions/types"
import { placements, type PlacementId } from "@/lib/placements"
import type { Platform } from "@/lib/setup"

export const day = (iso: string) => iso.slice(0, 10)

export function inPeriod(conversions: Conversion[], from?: string, to?: string) {
  return conversions.filter(
    (c) => (!from || day(c.createdAt) >= from) && (!to || day(c.createdAt) <= to),
  )
}

export type Tally = { count: number; revenue: number }
const empty = (): Tally => ({ count: 0, revenue: 0 })
const add = (t: Tally, c: Conversion) => {
  t.count++
  t.revenue += c.total
}

export function summarize(list: Conversion[]) {
  const revenue = list.reduce((sum, c) => sum + c.total, 0)
  const matched = list.filter((c) => c.attribution).length
  return {
    count: list.length,
    revenue,
    avgOrder: list.length ? revenue / list.length : 0,
    newCustomers: list.filter((c) => c.firstVisit).length,
    matched,
    matchedShare: list.length ? matched / list.length : 0,
  }
}

export function platformOf(c: Conversion): Platform | null {
  if (!c.attribution) return null
  return placements.find((p) => p.id === c.attribution!.placementId)!.platform
}

export function byPlatform(list: Conversion[]) {
  const out = { meta: empty(), google: empty(), unmatched: empty() }
  for (const c of list) add(out[platformOf(c) ?? "unmatched"], c)
  return out
}

export function byPlacement(list: Conversion[]) {
  const out = new Map<PlacementId, Tally>(placements.map((p) => [p.id, empty()]))
  for (const c of list) if (c.attribution) add(out.get(c.attribution.placementId)!, c)
  return out
}

export function byAd(list: Conversion[]) {
  const out = new Map<string, Tally>()
  for (const c of list) {
    const id = c.attribution?.adId
    if (!id) continue
    if (!out.has(id)) out.set(id, empty())
    add(out.get(id)!, c)
  }
  return out
}

export function byQrCode(list: Conversion[]) {
  const out = new Map<string, Tally & { last?: string }>()
  for (const c of list) {
    const t = out.get(c.qrCodeId) ?? { ...empty(), last: undefined }
    add(t, c)
    if (!t.last || c.createdAt > t.last) t.last = c.createdAt
    out.set(c.qrCodeId, t)
  }
  return out
}

// Conversions per day between two dates (inclusive), with zero-filled gaps.
export function perDay(list: Conversion[], from: string, to: string) {
  const counts = new Map<string, number>()
  for (const c of list) counts.set(day(c.createdAt), (counts.get(day(c.createdAt)) ?? 0) + 1)
  const out: { date: string; value: number }[] = []
  for (
    let t = Date.parse(`${from}T00:00:00Z`);
    t <= Date.parse(`${to}T00:00:00Z`);
    t += 86_400_000
  ) {
    const d = new Date(t).toISOString().slice(0, 10)
    out.push({ date: d, value: counts.get(d) ?? 0 })
  }
  return out
}

export type ConversionCustomer = {
  key: string
  email?: string
  phone?: string
  visits: number
  spend: number
  firstSeen: string
  lastSeen: string
  attribution: Conversion["attribution"]
}

// One row per customer (matched by email or phone), most recent first.
export function customers(list: Conversion[]): ConversionCustomer[] {
  const out = new Map<string, ConversionCustomer>()
  for (const c of [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const key = c.email ?? c.phone?.replace(/\D/g, "") ?? c.id
    const row = out.get(key) ?? {
      key,
      email: c.email,
      phone: c.phone,
      visits: 0,
      spend: 0,
      firstSeen: c.createdAt,
      lastSeen: c.createdAt,
      attribution: c.attribution,
    }
    row.visits++
    row.spend += c.total
    row.lastSeen = c.createdAt
    out.set(key, row)
  }
  return [...out.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
}

// "maya.patel42@gmail.com" → "ma•••@gmail.com", "(415) 555-1234" → "(•••) •••-1234"
export function maskContact(c: { email?: string; phone?: string }) {
  if (c.email) {
    const [name, domain] = c.email.split("@")
    return `${name.slice(0, 2)}•••@${domain}`
  }
  const d = c.phone?.replace(/\D/g, "") ?? ""
  return `(•••) •••-${d.slice(-4)}`
}

// Server-rendered pages call this once per request, so reading the clock here is fine.
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}
