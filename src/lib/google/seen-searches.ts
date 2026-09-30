// When each wasted search was first spotted, per person and ad account, so the dashboard can
// flag the ones that are new. Saved in .data/seen-searches.json (not committed).
import { jsonFileStore } from "@/lib/json-file-store"

type Db = Record<string, Record<string, string>> // "sub:customerId" → search key → first seen (ISO)

const file = jsonFileStore<Db>("seen-searches.json", () => ({}))

// Forget searches not seen for half a year, so the file doesn't grow forever.
const KEEP_MS = 180 * 86_400_000

// Records the keys and returns when each was first seen. On the first look at an account nothing
// is new yet (every search would be), so those come back without a date.
export async function firstSeen(sub: string, customerId: string, keys: string[], now = Date.now()) {
  return file.update((db) => {
    const id = `${sub}:${customerId}`
    const firstLook = !db[id]
    const seen = db[id] ?? {}
    // Searches found on the first look at an account were already there, not new: date them two
    // days back so they aren't tagged New on the next visit either.
    const stamp = new Date(firstLook ? now - 2 * 86_400_000 : now).toISOString()
    for (const key of keys) {
      if (!seen[key]) seen[key] = stamp
    }
    for (const [key, at] of Object.entries(seen)) {
      if (now - Date.parse(at) > KEEP_MS && !keys.includes(key)) delete seen[key]
    }
    db[id] = seen
    return new Map(keys.map((key) => [key, firstLook ? undefined : seen[key]]))
  })
}
