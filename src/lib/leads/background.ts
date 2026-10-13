// The Leads page's background work: new leads from the WordPress site (checked at most every 10
// seconds) and the team's statuses with it (team-sync.ts), taps on the website's phone number
// (call-taps.ts, at most every minute), scores for new leads, conversions for Google Ads and the
// spreadsheet (at most every 6 hours). Run after a page is sent, so nothing waits on it, and every
// 30 seconds while the app runs. From One Marketing Command Center.
import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"

import { activeAccount } from "@/lib/conversions/google"
import { sendPendingConversions } from "@/lib/conversions/offline-conversions"
import { syncSheetIfDue } from "@/lib/sheets/sync"
import { scoreUnscored } from "@/lib/leads/store"
import { syncCallTaps } from "@/lib/leads/call-taps"
import { claimSender, getWordPress, noteCanSend, senderGone, syncWordPress } from "@/lib/leads/wordpress"
import { shared } from "@/lib/shared-state"
import { DATA_DIR } from "@/lib/store"

async function sendConversions() {
  try {
    const active = await activeAccount()
    if (active) {
      noteCanSend()
      const name = active.connection.email || "DealTrack"
      // The team's site has no computer sending to Google Ads yet: this one does (team-sync.ts).
      if ((await getWordPress()).sender === null) await claimSender(name).catch(() => null)
      // The one that sent hasn't been heard from for a day: this one carries on.
      else if (await senderGone()) await claimSender(name, "if_stale").catch(() => null)
      void syncSheetIfDue(active.connection, active.account).catch((error) => console.error("Couldn't update the spreadsheet:", error))
      await sendPendingConversions(active.connection, active.account)
    }
  } catch (error) {
    console.error("Couldn't send conversions to Google Ads:", error)
  }
}

// Once the app has been opened, the same work goes on every 30 seconds while it runs, even with no
// page open (the window minimized, the browser closed): a teammate's status still reaches Google
// Ads, and website leads still come in.
const loop = shared("background-loop", () => ({ timer: null as ReturnType<typeof setInterval> | null }))
function keepRunning() {
  if (loop.timer) return
  loop.timer = setInterval(() => void catchUp().catch(() => {}), 30_000)
  loop.timer.unref?.()
}

export function catchUp() {
  keepRunning()
  return Promise.all([
    scoreUnscored()
      .then(() => syncWordPress())
      .catch((error) => console.error("Couldn't check the website for new leads:", error)),
    syncCallTaps().catch((error) => console.error("Couldn't check PostHog for call taps:", error)),
    sendConversions(),
  ])
}

// Changes whenever anything the Leads page shows is saved (leads, their statuses and Google Ads
// states, the website connection), so the page only reloads when there's something new. The
// website check's own "last checked" time doesn't count: it's saved every 10 seconds.
export async function leadsVersion() {
  const [leads, sheet, site] = await Promise.all([
    stat(path.join(DATA_DIR, "leads.json")).then(
      (s) => s.mtimeMs,
      () => 0,
    ),
    stat(path.join(DATA_DIR, "sheet-sync.json")).then(
      (s) => s.mtimeMs,
      () => 0,
    ),
    readFile(path.join(DATA_DIR, "wordpress.json"), "utf8").then(
      (text) => {
        try {
          const state = JSON.parse(text) as Record<string, unknown>
          delete state.lastSync
          return createHash("sha1").update(JSON.stringify(state)).digest("hex").slice(0, 12)
        } catch {
          return text.length
        }
      },
      () => 0,
    ),
  ])
  return `${leads}-${sheet}-${site}`
}
