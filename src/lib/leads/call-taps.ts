// Taps on the website's phone number, brought in as leads the same way form submissions are.
// Two places see them, so a tap is caught even when one misses it:
// - PostHog (already on twinhomebuyer.com) records every tap on a "tel:" link with the page,
//   device, city and the visit's campaign tags (utm, gclid). The app checks for new taps at most
//   once a minute while it's open; PostHog shows a tap a minute or two after it happens. Browsers
//   that block PostHog (ad blockers, some iPhones) don't show up there.
// - The Lead Saver plugin (1.6+) notes each tap on the site itself, with where the visitor came
//   from (the same memory the forms use), picked up with the website check (wordpress.ts).
// A tap seen by both is one lead: they share the visitor's PostHog id when the page has it.
//
// A tap means someone started a call, not that it connected: the call itself (who, how long) is in
// REI BlackBook. So these leads are never scored or sent to Google Ads on their own; once the team
// sets a status (Interested…), they go to Google Ads like any other lead, matched by the ad click.
import { jsonFileStore } from "@/lib/json-file-store"
import { addLead, listLeads, updateLead } from "@/lib/leads/store"
import { completeTracking } from "@/lib/leads/tracking"
import { CALL_TAP_SOURCE, type LeadTracking } from "@/lib/leads/types"
import { hogqlFresh } from "@/lib/posthog"
import { ServiceError } from "@/lib/services"
import { shared } from "@/lib/shared-state"

// `recent`: the last few days' taps from either place (lead: the lead each became or joined).
type Recent = { key: string; at: string; visitor: string; number: string; lead: string }
type State = { lastAt?: string; lastSync?: string; lastError?: string; added?: number; rechecked?: string[]; recent?: Recent[]; more?: boolean }
const file = jsonFileStore<State>("call-taps.json", () => ({}))
export const getCallTaps = () => file.read()

const SYNC_EVERY_MS = 60_000
// The first check looks back a week; after that, from the last tap brought in.
const FIRST_LOOK_BACK_MS = 7 * 86_400_000
// Several taps by the same visitor within this long are one call attempt.
const SAME_CALL_MS = 30 * 60_000
// PostHog can show a tap late (phones send in batches): each check looks this far back again.
const LATE_MS = 2 * 60 * 60_000
// The same number tapped within this long, once seen by PostHog and once by the site, is one tap
// even when the page didn't have the visitor's PostHog id yet.
const SAME_TAP_MS = 3 * 60_000
const sync = shared("call-tap-sync", () => ({ lastAttempt: 0, running: null as Promise<void> | null }))

const configured = () => Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID)

// Where the caller came from. The page they tapped on rarely says (by then they've usually clicked
// around the site, so its referrer is the site itself): the tags come from the address this visit
// started on, then the page tapped on, then the visitor's very first visit (someone who clicked an
// ad last week and came back to call). The referrer is the first outside site among those.
type Seen = { current: string; referrer: string; entry: string; entryFrom: string; first: string; firstFrom: string }
const TAGS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_keyword", "utm_content", "gclid", "gbraid", "wbraid", "gad_source", "fbclid", "msclkid"]
const params = (url: string) => {
  try {
    return new URL(url).searchParams
  } catch {
    return null
  }
}
const isSite = (from: string) => /(^|\.)twinhomebuyer\.com$/i.test(from.replace(/^https?:\/\//, "").split(/[/:?#]/)[0])
// PostHog gives either a whole address or just a domain ("www.google.com", or "$direct").
const outside = (from: string) => (!from || from === "$direct" || isSite(from) ? "" : /^https?:\/\//.test(from) ? from : `https://${from}/`)

function trackingFrom(v: Seen): LeadTracking | undefined {
  const tagged = [v.entry, v.current, v.first].map(params).find((q) => q && TAGS.some((k) => q.get(k)))
  const get = (k: string) => tagged?.get(k) || undefined
  const t: LeadTracking = {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmTerm: get("utm_term") || get("utm_keyword"),
    utmContent: get("utm_content"),
    gclid: get("gclid"),
    gbraid: get("gbraid"),
    wbraid: get("wbraid"),
    gadSource: get("gad_source"),
    fbclid: get("fbclid"),
    msclkid: get("msclkid"),
    landingPage: (v.entry || v.first || v.current).split("?")[0] || undefined,
    referrer: outside(v.entryFrom) || outside(v.referrer) || outside(v.firstFrom) || undefined,
  }
  const kept = Object.fromEntries(Object.entries(t).filter(([, x]) => x)) as LeadTracking
  return Object.keys(kept).length ? kept : undefined
}
const knowsSource = (t?: LeadTracking) => Boolean(t && (t.utmSource || t.gclid || t.gbraid || t.wbraid || t.gadSource || t.fbclid || t.msclkid || t.referrer))

// The tap's details. Older PostHog projects may not have the visit or visitor fields; then the
// tap still comes in, with what the tap itself says.
const FULL = `properties.$referrer as referrer, session.$entry_current_url as entry, session.$entry_referring_domain as entry_from,
  person.properties.$initial_current_url as first, person.properties.$initial_referrer as first_from`
const BASIC = `properties.$referrer as referrer, '' as entry, '' as entry_from, '' as first, '' as first_from`
async function tapRows(where: string, fields = FULL): Promise<Record<string, unknown>[]> {
  try {
    return await hogqlFresh(`
      select toString(uuid) as uuid, timestamp as at, distinct_id as visitor, properties.$current_url as current,
        properties.$device_type as device, properties.$geoip_city_name as city, properties.$geoip_subdivision_1_code as region,
        extract(elements_chain, '(?i)href="(tel:[^"]+)"') as tel, ${fields}
      from events
      where event = '$autocapture' and elements_chain ilike '%href="tel:%'
        and (properties.$host = 'twinhomebuyer.com' or properties.$host like '%.twinhomebuyer.com')
        and ${where}
      order by timestamp asc limit 500`)
  } catch (error) {
    // Only when PostHog didn't understand the question (not when it was busy or unreachable).
    const detail = error instanceof ServiceError ? (error.detail ?? "") : ""
    if (fields === BASIC || !/field|resolve|unknown|column|propert|session|person/i.test(detail)) throw error
    return tapRows(where, BASIC)
  }
}
function readRow(r: Record<string, unknown>) {
  const get = (k: string) => (r[k] == null ? "" : String(r[k]))
  const [uuid, at, visitor, current, device, city, region, tel, referrer, entry, entryFrom, first, firstFrom] =
    ["uuid", "at", "visitor", "current", "device", "city", "region", "tel", "referrer", "entry", "entry_from", "first", "first_from"].map(get)
  return { uuid, at, visitor, current, device, city, region, tel, seen: { current, referrer, entry, entryFrom, first, firstFrom } }
}

// Taps brought in before the app looked this far: asked about once more, and the source filled in.
async function fillMissingSources(state: State) {
  const done = new Set(state.rechecked ?? [])
  const missing = (await listLeads())
    .filter((l) => l.source === CALL_TAP_SOURCE && !knowsSource(l.tracking) && Date.now() - Date.parse(l.createdAt) < 30 * 86_400_000)
    .map((l) => ({ id: l.id, uuid: (l.inboxId?.split(":")[2] ?? "").replace(/^ph/, "") }))
    .filter((l) => /^[0-9a-f-]{36}$/i.test(l.uuid) && !done.has(l.uuid))
    .slice(0, 50)
  if (!missing.length) return
  const rows = await tapRows(`timestamp > now() - interval 31 day and toString(uuid) in (${missing.map((l) => `'${l.uuid}'`).join(", ")})`)
  for (const r of rows.map(readRow)) {
    const lead = missing.find((l) => l.uuid === r.uuid)
    const tracking = trackingFrom(r.seen)
    if (lead && knowsSource(tracking)) await updateLead(lead.id, (l) => void (l.tracking = { ...l.tracking, ...tracking }))
  }
  await file.update((s) => {
    s.rechecked = [...(s.rechecked ?? []), ...missing.map((l) => l.uuid)].slice(-500)
  })
}

const shownNumber = (tel: string) => {
  const d = tel.replace(/\D/g, "").slice(-10)
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : tel.replace(/^tel:/i, "")
}
const digits = (tel: string) => tel.replace(/\D/g, "").slice(-10)
const pathOf = (url: string) => {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}
// Lead ids are "tap:<visitor>:<tap>", so neither may have a ":".
const safe = (id: string) => id.replace(/[^\w.$-]/g, "_").slice(0, 100)

type Tap = { key: string; at: number; visitor: string; number: string; page: string; device?: string; place?: string; tracking?: LeadTracking; via: "PostHog" | "website" }

// One tap at a time, from either place, so the same tap can't become two leads.
const queue = shared("call-tap-queue", () => ({ last: Promise.resolve() as Promise<unknown> }))
function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.last.then(work, work)
  queue.last = next.catch(() => {})
  return next
}

// Adds the taps as leads: a tap already in, or another tap of the same call attempt, joins that
// lead instead (filling in where the caller came from, if it didn't know yet). Returns how many
// leads were added.
function addTaps(taps: Tap[]) {
  return oneAtATime(async () => {
    const state = await file.read()
    const recent = (state.recent ?? []).filter((r) => Date.now() - Date.parse(r.at) < 3 * 86_400_000)
    const leads = (await listLeads()).filter((l) => l.source === CALL_TAP_SOURCE)
    let added = 0
    for (const t of [...taps].sort((a, b) => a.at - b.at)) {
      const key = safe(t.key)
      // (No visitor id: on its own, not lumped in with others that have none.)
      const visitor = safe(t.visitor) || key
      const near = (r: { at: string }, ms: number) => Math.abs(Date.parse(r.at) - t.at) < ms
      const mine = t.via === "website" ? "wp" : "ph"
      // Already in: nothing to do.
      if (leads.some((l) => l.inboxId?.endsWith(`:${key}`)) || recent.some((r) => r.key === key)) continue
      // The same visitor tapping again within half an hour: the same call attempt.
      const again =
        recent.find((r) => r.visitor === visitor && near(r, SAME_CALL_MS))?.lead ??
        leads.find((l) => l.inboxId?.split(":")[1] === visitor && near({ at: l.createdAt }, SAME_CALL_MS))?.id
      // This tap as the other place saw it (same number, within minutes): only a lead that place
      // hasn't already been matched for, and never two different PostHog visitors.
      const known = (v: string) => Boolean(v) && !v.startsWith("wp")
      const other = again
        ? undefined
        : recent.find(
            (r) =>
              r.number === digits(t.number) &&
              near(r, SAME_TAP_MS) &&
              !r.key.startsWith(mine) &&
              !recent.some((x) => x.lead === r.lead && x.key.startsWith(mine)) &&
              !(known(r.visitor) && known(visitor) && r.visitor !== visitor),
          )?.lead
      const before = again ?? other
      if (before) {
        recent.push({ key, at: new Date(t.at).toISOString(), visitor, number: digits(t.number), lead: before })
        const lead = leads.find((l) => l.id === before)
        // A new tap (not the same one seen from the other place): noted on the lead.
        if (lead && again && recent.some((r) => r.lead === before && r.key !== key && r.key.startsWith(mine))) {
          const when = new Date(t.at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
          await updateLead(lead.id, (l) => void (l.notes = `${l.notes ?? ""}\nTapped ${shownNumber(t.number)} again, ${when}.`.trim()))
        }
        if (lead && t.tracking && !knowsSource(lead.tracking) && knowsSource(t.tracking)) {
          await updateLead(lead.id, (l) => void (l.tracking = { ...l.tracking, ...t.tracking }))
          lead.tracking = { ...lead.tracking, ...t.tracking }
        }
        continue
      }
      const at = new Date(Math.min(t.at, Date.now())).toISOString()
      const lead = await addLead(
        {
          name: "Website caller (tapped the phone number)",
          source: CALL_TAP_SOURCE,
          notes: `Tapped ${shownNumber(t.number)} on ${pathOf(t.page)}${t.device ? ` · ${t.device}` : ""}${t.place ? ` · ${t.place}` : ""}. The call is in REI BlackBook: find it there, add the caller's details, and set the status.`,
          tracking: t.tracking,
          inboxId: `tap:${visitor}:${key}`,
        },
        at,
      )
      leads.push(lead)
      recent.push({ key, at, visitor, number: digits(t.number), lead: lead.id })
      added++
    }
    await file.update((s) => {
      s.recent = recent.slice(-2000)
      s.added = (s.added ?? 0) + added
    })
    return added
  })
}

// The taps the website's plugin noted (`fields` as the visitor's browser sent them).
export async function addSiteTaps(raw: { id: number; at: string; fields?: Record<string, unknown> }[]) {
  const text = (v: unknown, max = 500) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined)
  const taps = raw.flatMap((r): Tap[] => {
    const f = r.fields ?? {}
    const number = text(f.number, 20)
    const at = Date.parse(r.at)
    if (!number || !Number.isFinite(r.id) || Number.isNaN(at)) return []
    const tracking = completeTracking({
      utmSource: text(f.utm_source),
      utmMedium: text(f.utm_medium),
      utmCampaign: text(f.utm_campaign),
      utmTerm: text(f.utm_term),
      utmContent: text(f.utm_content),
      gclid: text(f.gclid),
      gbraid: text(f.gbraid),
      wbraid: text(f.wbraid),
      gadSource: text(f.gad_source),
      fbclid: text(f.fbclid),
      msclkid: text(f.msclkid),
      landingPage: text(f.landing_page),
      // The site itself isn't where they came from.
      referrer: outside(text(f.referrer) ?? "") || undefined,
    })
    const kept = tracking && (Object.fromEntries(Object.entries(tracking).filter(([, v]) => v)) as LeadTracking)
    return [
      {
        key: `wp${r.id}`,
        at,
        visitor: text(f.ph, 100) || (text(f.vid, 60) ? `wp-${text(f.vid, 60)}` : `wp${r.id}`),
        number,
        page: text(f.page) ?? "",
        device: f.mobile === "1" ? "Mobile" : "Desktop",
        tracking: kept && Object.keys(kept).length ? kept : undefined,
        via: "website",
      },
    ]
  })
  return taps.length ? addTaps(taps) : 0
}

export function syncCallTaps(): Promise<void> {
  if (!configured()) return Promise.resolve()
  if (sync.running) return sync.running
  if (Date.now() - sync.lastAttempt < SYNC_EVERY_MS) return Promise.resolve()
  sync.lastAttempt = Date.now()
  sync.running = (async () => {
    const state = await file.read()
    // From the last tap brought in, and a while before it for taps PostHog showed late.
    // (When the last check got a full page, the rest come first.)
    const since = state.lastAt ? Date.parse(state.lastAt) - (state.more ? 0 : LATE_MS) : Date.now() - FIRST_LOOK_BACK_MS
    const seconds = Math.max(60, Math.ceil((Date.now() - since) / 1000) + 5)
    try {
      const rows = (await tapRows(`timestamp > now() - interval ${seconds} second`)).map(readRow)
      const taps = rows.flatMap((r): Tap[] => {
        const at = Date.parse(r.at)
        if (Number.isNaN(at) || !r.uuid) return []
        const place = [r.city, /^[A-Z]{2}$/.test(r.region) ? r.region : ""].filter(Boolean).join(", ")
        return [{ key: `ph${r.uuid}`, at, visitor: r.visitor, number: r.tel, page: r.current, device: r.device, place, tracking: trackingFrom(r.seen), via: "PostHog" }]
      })
      // Leads from before the "ph" prefix are "tap:<visitor>:<uuid>".
      const old = new Set((await listLeads()).filter((l) => l.source === CALL_TAP_SOURCE).map((l) => l.inboxId?.split(":")[2]))
      await addTaps(taps.filter((t) => !old.has(t.key.slice(2))))
      const newest = Math.min(Date.now(), Math.max(state.lastAt ? Date.parse(state.lastAt) : 0, ...taps.map((t) => t.at)))
      await file.update((s) => {
        s.lastAt = newest ? new Date(newest).toISOString() : (s.lastAt ?? new Date(since).toISOString())
        s.lastSync = new Date().toISOString()
        s.more = rows.length >= 500
        delete s.lastError
      })
      await fillMissingSources(state).catch((error) => console.error("Couldn't look up where earlier callers came from:", error))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await file.update((s) => {
        s.lastError = message.slice(0, 300)
        s.lastSync = new Date().toISOString()
      })
    }
  })().finally(() => {
    sync.running = null
  })
  return sync.running
}
