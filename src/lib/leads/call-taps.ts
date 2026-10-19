// Taps on the website's phone number, brought in as leads the same way form submissions are.
// PostHog (already on twinhomebuyer.com) records every tap on a "tel:" link with the page, device,
// city and the visit's campaign tags (utm, gclid). The app checks for new taps at most once a
// minute while it's open; PostHog shows a tap a minute or two after it happens.
//
// A tap means someone started a call, not that it connected: the call itself (who, how long) is in
// REI BlackBook. So these leads are never scored or sent to Google Ads on their own; once the team
// sets a status (Interested…), they go to Google Ads like any other lead, matched by the ad click.
import { jsonFileStore } from "@/lib/json-file-store"
import { addLead, listLeads, updateLead } from "@/lib/leads/store"
import { CALL_TAP_SOURCE, type LeadTracking } from "@/lib/leads/types"
import { hogqlFresh } from "@/lib/posthog"
import { shared } from "@/lib/shared-state"

type State = { lastAt?: string; lastSync?: string; lastError?: string; added?: number; rechecked?: string[] }
const file = jsonFileStore<State>("call-taps.json", () => ({}))
export const getCallTaps = () => file.read()

const SYNC_EVERY_MS = 60_000
// The first check looks back a week; after that, from the last tap brought in.
const FIRST_LOOK_BACK_MS = 7 * 86_400_000
// Several taps by the same visitor within this long are one call attempt.
const SAME_CALL_MS = 30 * 60_000
const sync = shared("call-tap-sync", () => ({ lastAttempt: 0, running: null as Promise<void> | null }))

const configured = () => Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID)

// Where the caller came from. The page they tapped on rarely says (by then they've usually clicked
// around the site, so its referrer is the site itself): the tags come from the address this visit
// started on, then the page tapped on, then the visitor's very first visit (someone who clicked an
// ad last week and came back to call). The referrer is the first outside site among those.
type Seen = { current: string; referrer: string; entry: string; entryFrom: string; first: string; firstFrom: string }
const TAGS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_keyword", "utm_content", "gclid", "gbraid", "wbraid", "fbclid", "msclkid"]
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
    fbclid: get("fbclid"),
    msclkid: get("msclkid"),
    landingPage: (v.entry || v.first || v.current).split("?")[0] || undefined,
    referrer: outside(v.entryFrom) || outside(v.referrer) || outside(v.firstFrom) || undefined,
  }
  const kept = Object.fromEntries(Object.entries(t).filter(([, x]) => x)) as LeadTracking
  return Object.keys(kept).length ? kept : undefined
}
const knowsSource = (t?: LeadTracking) => Boolean(t && (t.utmSource || t.gclid || t.gbraid || t.wbraid || t.fbclid || t.msclkid || t.referrer))

// The tap's details. Older PostHog projects may not have the visit or visitor fields; then the
// tap still comes in, with what the tap itself says.
const FULL = `properties.$referrer as referrer, session.$entry_current_url as entry, session.$entry_referring_domain as entry_from,
  person.properties.$initial_current_url as first, person.properties.$initial_referrer as first_from`
const BASIC = `properties.$referrer as referrer, session.$entry_current_url as entry, '' as entry_from, '' as first, '' as first_from`
async function tapRows(where: string, fields = FULL): Promise<Record<string, unknown>[]> {
  try {
    return await hogqlFresh(`
      select toString(uuid) as uuid, timestamp as at, distinct_id as visitor, properties.$current_url as current,
        properties.$device_type as device, properties.$geoip_city_name as city, properties.$geoip_subdivision_1_code as region,
        extract(elements_chain, 'href="(tel:[^"]+)"') as tel, ${fields}
      from events
      where event = '$autocapture' and elements_chain like '%href="tel:%'
        and properties.$host in ('www.twinhomebuyer.com', 'twinhomebuyer.com')
        and ${where}
      order by timestamp asc limit 500`)
  } catch (error) {
    if (fields === BASIC) throw error
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
    .map((l) => ({ id: l.id, uuid: l.inboxId?.split(":")[2] ?? "" }))
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
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : tel.replace(/^tel:/, "")
}
const pathOf = (url: string) => {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

export function syncCallTaps(): Promise<void> {
  if (!configured()) return Promise.resolve()
  if (sync.running) return sync.running
  if (Date.now() - sync.lastAttempt < SYNC_EVERY_MS) return Promise.resolve()
  sync.lastAttempt = Date.now()
  sync.running = (async () => {
    const state = await file.read()
    const since = state.lastAt ? Date.parse(state.lastAt) : Date.now() - FIRST_LOOK_BACK_MS
    const seconds = Math.max(60, Math.ceil((Date.now() - since) / 1000) + 5)
    try {
      const rows = (await tapRows(`timestamp > now() - interval ${seconds} second`)).map(readRow)
      const existing = (await listLeads()).filter((l) => l.source === CALL_TAP_SOURCE)
      const lastByVisitor = new Map<string, number>()
      for (const l of existing) {
        const visitor = l.inboxId?.split(":")[1]
        if (visitor) lastByVisitor.set(visitor, Math.max(lastByVisitor.get(visitor) ?? 0, Date.parse(l.createdAt)))
      }
      let lastAt = state.lastAt
      let added = 0
      for (const r of rows) {
        const { uuid, at, visitor, current, device, city, region, tel, seen } = r
        const when = Date.parse(at)
        if (Number.isNaN(when) || (state.lastAt && when <= Date.parse(state.lastAt))) continue
        lastAt = new Date(when).toISOString()
        // Tapping twice (or again a few minutes later) is the same call attempt.
        const previous = lastByVisitor.get(visitor)
        lastByVisitor.set(visitor, when)
        if (previous && when - previous < SAME_CALL_MS) continue
        const place = [city, /^[A-Z]{2}$/.test(region) ? region : ""].filter(Boolean).join(", ")
        await addLead(
          {
            name: "Website caller (tapped the phone number)",
            source: CALL_TAP_SOURCE,
            notes: `Tapped ${shownNumber(tel)} on ${pathOf(current)}${device ? ` · ${device}` : ""}${place ? ` · ${place}` : ""}. The call is in REI BlackBook: find it there, add the caller's details, and set the status.`,
            tracking: trackingFrom(seen),
            inboxId: `tap:${visitor}:${uuid}`,
          },
          lastAt,
        )
        added++
      }
      await file.update((s) => {
        s.lastAt = lastAt ?? s.lastAt ?? new Date(since).toISOString()
        s.lastSync = new Date().toISOString()
        s.added = (s.added ?? 0) + added
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
