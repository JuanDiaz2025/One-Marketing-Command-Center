// Keeps a team's copies of the app in step. Each person can run the app on their own computer; the
// WordPress site (always online, the Lead Saver plugin 1.4+) is where they meet: every status
// someone sets is reported there, and every copy picks up the others' within seconds (with the
// website check, wordpress.ts). Only website leads are shared, since every copy has them.
//
// Only one computer sends to Google Ads for shared leads (the first with Google Ads connected, or
// whichever takes over), so the same lead is never sent twice from two computers.
import { randomBytes } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { applyStatus } from "@/lib/leads/status"
import { listLeads, updateLead } from "@/lib/leads/store"
import { leadStatuses, type Lead, type LeadStatus } from "@/lib/leads/types"
import { shared } from "@/lib/shared-state"

// This copy of the app, so it can tell its own reports from the others'. Kept in .data, so a copy
// brought over to a new computer (restore-data.ps1) is still the same one.
const idFile = path.join(process.cwd(), ".data", "install-id")
const ids = shared("install-id", () => ({ id: null as Promise<string> | null }))
export function installId() {
  ids.id ??= readFile(idFile, "utf8")
    .then((text) => text.trim() || Promise.reject(new Error("empty")))
    .catch(async () => {
      const id = randomBytes(12).toString("base64url")
      await mkdir(path.dirname(idFile), { recursive: true }).catch(() => {})
      await writeFile(idFile, id).catch((error) => console.error("Couldn't save this copy's id:", error))
      return id
    })
  return ids.id
}

// A new id for this copy: joining a team makes it a new member, even if its files were copied
// from another computer (which would otherwise share that computer's id).
export async function newInstallId() {
  const id = randomBytes(12).toString("base64url")
  await mkdir(path.dirname(idFile), { recursive: true })
  await writeFile(idFile, id)
  ids.id = Promise.resolve(id)
}

// What every copy calls the same lead: its place in the website's saved leads.
export const sharedKey = (lead: Pick<Lead, "inboxId">) => lead.inboxId?.replace(/^wp:www\./, "wp:")

export type StatusChange = { seq: number; key: string; status: string; at: string | number; by?: string; from?: string }
export type Sender = { id: string; name?: string; at?: string }

// Statuses set here and not yet reported, oldest first.
export async function unsharedChanges() {
  return (await listLeads())
    .filter((l) => l.statusShare === "pending" && sharedKey(l))
    .map((l) => ({ id: l.id, key: sharedKey(l)!, status: l.status ?? "new", at: l.statusChangedAt ?? new Date().toISOString(), by: l.statusByName ?? "" }))
    .reverse()
}

// Reported: unless the status changed again meanwhile (then that one goes next time).
export async function markShared(changes: { id: string; at: string }[]) {
  for (const c of changes) {
    await updateLead(c.id, (l) => {
      if (l.statusChangedAt === c.at) delete l.statusShare
    })
  }
}

// Applies the statuses others set. The latest one wins: a change made here after theirs stays.
export async function applyChanges(changes: StatusChange[], me: string) {
  const latest = new Map<string, StatusChange>()
  for (const c of changes) {
    if (c.from !== me && leadStatuses.some((s) => s.id === c.status)) latest.set(c.key, c)
  }
  if (!latest.size) return 0
  const leads = await listLeads()
  let applied = 0
  for (const [key, c] of latest) {
    const lead = leads.find((l) => sharedKey(l) === key)
    if (!lead) continue
    // Milliseconds since 1970 (plugin 1.4).
    const at = /^\d+$/.test(String(c.at)) ? Number(c.at) : Date.parse(String(c.at))
    if (Number.isNaN(at)) continue
    const ours = lead.statusBy === "you" && lead.statusChangedAt ? Date.parse(lead.statusChangedAt) : 0
    if (at <= ours) continue
    await updateLead(lead.id, (l) => {
      if (l.status === c.status && l.statusBy === "you") {
        l.statusByName = c.by || l.statusByName
        return
      }
      applyStatus(l, c.status as LeadStatus, "you", new Date(at).toISOString())
      l.statusByName = c.by || undefined
      // It came from the team: nothing to report back.
      delete l.statusShare
    })
    applied++
  }
  return applied
}

// The team code: the site and its key in one line, pasted on a teammate's computer to join.
const CODE_PREFIX = "omcc-team:"
export const teamCode = (site: string, key: string) => CODE_PREFIX + Buffer.from(JSON.stringify({ site, key })).toString("base64url")
export function readTeamCode(code: string): { site: string; key: string } | null {
  const text = code.trim().replace(/\s+/g, "")
  if (!text.startsWith(CODE_PREFIX)) return null
  try {
    const { site, key } = JSON.parse(Buffer.from(text.slice(CODE_PREFIX.length), "base64url").toString("utf8")) as { site?: unknown; key?: unknown }
    return typeof site === "string" && typeof key === "string" && /^https?:\/\//.test(site) && key.length >= 16 ? { site, key } : null
  } catch {
    return null
  }
}
