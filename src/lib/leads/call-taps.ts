// Taps on a phone number on the website (the Lead Saver plugin 1.5+ notes each one with where the
// visitor came from), picked up with the website check. A tap is someone starting a call from the
// site: the app can't hear the call, but it knows which ad or search brought them, so a tap added
// as a lead is sent to Google Ads matched by that ad click.
import { jsonFileStore } from "@/lib/json-file-store"
import { completeTracking } from "@/lib/leads/tracking"
import type { LeadTracking } from "@/lib/leads/types"

export type CallTap = {
  id: number // the site's numbering
  at: string // ISO time
  number: string // the number tapped, e.g. +15108001662
  page?: string // where on the site
  mobile?: boolean
  tracking?: LeadTracking
}

const file = jsonFileStore<{ taps: CallTap[] }>("call-taps.json", () => ({ taps: [] }))
const KEEP = 1000

// Newest first.
export async function listTaps() {
  return [...(await file.read()).taps].sort((a, b) => b.at.localeCompare(a.at))
}

const text = (v: unknown, max = 500) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined)

// The plugin's taps (`fields` as the visitor's browser sent them) into the app's.
export async function saveTaps(raw: { id: number; at: string; fields?: Record<string, unknown> }[]) {
  const taps: CallTap[] = raw.flatMap((r) => {
    const f = r.fields ?? {}
    const number = text(f.number, 20)
    if (!number || !Number.isFinite(r.id) || Number.isNaN(Date.parse(r.at))) return []
    const tracking = completeTracking({
      utmSource: text(f.utm_source),
      utmMedium: text(f.utm_medium),
      utmCampaign: text(f.utm_campaign),
      utmTerm: text(f.utm_term),
      utmContent: text(f.utm_content),
      gclid: text(f.gclid),
      gbraid: text(f.gbraid),
      wbraid: text(f.wbraid),
      fbclid: text(f.fbclid),
      msclkid: text(f.msclkid),
      landingPage: text(f.landing_page),
      referrer: text(f.referrer),
    })
    const clean = tracking && Object.fromEntries(Object.entries(tracking).filter(([, v]) => v))
    return [{ id: r.id, at: new Date(r.at).toISOString(), number, page: text(f.page), mobile: f.mobile === "1", tracking: clean && Object.keys(clean).length ? clean : undefined }]
  })
  if (!taps.length) return
  await file.update((db) => {
    const known = new Set(db.taps.map((t) => t.id))
    db.taps.push(...taps.filter((t) => !known.has(t.id)))
    db.taps.sort((a, b) => b.at.localeCompare(a.at))
    db.taps.splice(KEEP)
  })
}

// Connected to a different site: its taps aren't this one's.
export async function clearTaps() {
  await file.update((db) => {
    db.taps = []
  })
}

// The last `days` days of taps, newest first.
export async function recentTaps(days = 30) {
  const since = Date.now() - days * 86_400_000
  return (await listTaps()).filter((t) => Date.parse(t.at) >= since)
}

// "+15108001662" → "(510) 800-1662".
export function formatPhone(number: string) {
  const d = number.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "")
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : number
}
