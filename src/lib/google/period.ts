// The dashboard's date range: a preset (last 7/30/90 days, all time) or exact dates picked on the
// calendar. Read from the address bar (?range=30, ?range=all, or ?from=2026-08-01&to=2026-08-31).

export const presets = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "all", label: "All time", days: 0 },
] as const

export type Period = {
  preset: (typeof presets)[number]["id"] | "custom"
  start: string // YYYY-MM-DD
  end: string
  today: string // the latest date that can be picked
}

// Google Ads launched in 2000; "all time" asks from then and the report trims to the first day with data.
export const ALL_TIME_START = "2000-01-01"

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return isoDay(d)
}

const isDay = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && isoDay(new Date(`${v}T00:00:00Z`)) === v

// Presets end yesterday, since today's numbers are still coming in. Picked dates may include today.
export function resolvePeriod(
  q: { range?: string | string[]; from?: string | string[]; to?: string | string[] },
  now = new Date(),
): Period {
  // Today on this computer's clock (the business's own day), not in UTC, which is already
  // tomorrow from late afternoon in California.
  const today = localDay(now)
  const yesterday = shift(today, -1)
  const from = Array.isArray(q.from) ? q.from[0] : q.from
  const to = Array.isArray(q.to) ? q.to[0] : q.to

  if (isDay(from) || isDay(to)) {
    let start = isDay(from) ? from : isDay(to) ? to : yesterday
    let end = isDay(to) ? to : today
    if (start > end) [start, end] = [end, start]
    if (end > today) end = today
    if (start > end) start = end
    if (start < ALL_TIME_START) start = ALL_TIME_START
    if (end < start) end = start
    return { preset: "custom", start, end, today }
  }

  const id = Array.isArray(q.range) ? q.range[0] : q.range
  const preset = presets.find((p) => p.id === id) ?? presets[1]
  if (preset.id === "all") return { preset: "all", start: ALL_TIME_START, end: yesterday, today }
  return { preset: preset.id, start: shift(yesterday, 1 - preset.days), end: yesterday, today }
}

// The address-bar part that brings this period back, e.g. to keep it when switching accounts.
export function periodQuery(p: Period) {
  return p.preset === "custom"
    ? `from=${p.start}&to=${p.end}`
    : `range=${p.preset}`
}

const short = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })

// For sentences: "in the last 30 days", "since Mar 3, 2024", "from Aug 1, 2026 to Aug 31, 2026".
export function describePeriod(p: Period) {
  if (p.preset === "all") return "since the account started"
  if (p.preset !== "custom") return `in the last ${p.preset} days`
  return p.start === p.end ? `on ${short(p.start)}` : `from ${short(p.start)} to ${short(p.end)}`
}
