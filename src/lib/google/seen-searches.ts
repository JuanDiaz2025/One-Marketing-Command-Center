// When each wasted search was first spotted, per person and ad account, so the dashboard can
// flag the ones that are new. Saved in .data/seen-searches.json (not committed).
import { jsonFileStore } from "@/lib/json-file-store"

type Db = Record<string, Record<string, string>> // "sub:customerId" → search key → first seen (ISO)

const file = jsonFileStore<Db>("seen-searches.json", () => ({}))

// Forget searches not seen for half a year, so the file doesn't grow forever.
const KEEP_MS = 180 * 86_400_000

// Records the keys and returns when each was first seen.
export async function firstSeen(sub: string, customerId: string, keys: string[], now = Date.now()) {
  const db = await file.read()
  const id = `${sub}:${customerId}`
  const seen = db[id] ?? {}
  let changed = false
  for (const key of keys) {
    if (!seen[key]) {
      seen[key] = new Date(now).toISOString()
      changed = true
    }
  }
  for (const [key, at] of Object.entries(seen)) {
    if (now - Date.parse(at) > KEEP_MS && !keys.includes(key)) {
      delete seen[key]
      changed = true
    }
  }
  if (changed) {
    db[id] = seen
    await file.write(db)
  }
  return new Map(keys.map((key) => [key, seen[key]]))
}
