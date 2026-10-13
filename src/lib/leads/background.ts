// The Leads page's background work: new leads from the WordPress site (checked at most every 10
// seconds), scores for new leads, conversions for Google Ads and the spreadsheet (at most every
// 6 hours). Run after a page is sent, so nothing waits on it.
import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"

import { senderAccount } from "@/lib/google/active-account"
import { sendPendingConversions } from "@/lib/google/offline-conversions"
import { syncSheetIfDue } from "@/lib/google/sheets-sync"
import { scoreUnscored } from "@/lib/leads/store"
import { shared } from "@/lib/shared-state"
import { claimSender, getWordPress, noteCanSend, senderGone, syncWordPress } from "@/lib/leads/wordpress"

async function sendConversions(sub: string) {
  try {
    const active = await senderAccount(sub)
    if (active) {
      noteCanSend()
      // The team's site has no computer sending to Google Ads yet: this one does (team-sync.ts).
      if ((await getWordPress()).sender === null) await claimSender(active.connection.email).catch(() => null)
      // The one that sent hasn't been heard from for a day: this one carries on.
      else if (await senderGone()) await claimSender(active.connection.email, "if_stale").catch(() => null)
      void syncSheetIfDue(active.connection, active.account).catch((error) => console.error("Couldn't update the spreadsheet:", error))
      await sendPendingConversions(active.connection, active.account)
    }
  } catch (error) {
    console.error("Couldn't send conversions to Google Ads:", error)
  }
}

// Once the app has been opened, the same work goes on every 30 seconds while it runs, even with no
// page open (the window minimized, the browser closed): a teammate's status still reaches Google
// Ads, and website leads still come in. With no one signed in, the team's first Google Ads
// connection is used (senderAccount).
const loop = shared("background-loop", () => ({ timer: null as ReturnType<typeof setInterval> | null }))
function keepRunning() {
  if (loop.timer) return
  loop.timer = setInterval(() => void catchUp("").catch(() => {}), 30_000)
  loop.timer.unref?.()
}

export function catchUp(sub: string) {
  keepRunning()
  return Promise.all([
    scoreUnscored()
      .then(() => syncWordPress())
      .catch((error) => console.error("Couldn't check the website for new leads:", error)),
    sendConversions(sub),
  ])
}

// Changes whenever anything the Leads page shows is saved (leads, their statuses and Google Ads
// states, the website connection), so the page only reloads when there's something new. The
// website check's own "last checked" time doesn't count: it's saved every 30 seconds.
export async function leadsVersion() {
  const dir = path.join(process.cwd(), ".data")
  const [leads, sheet, site, taps] = await Promise.all([
    stat(path.join(dir, "leads.json")).then((s) => s.mtimeMs, () => 0),
    stat(path.join(dir, "sheet-sync.json")).then((s) => s.mtimeMs, () => 0),
    readFile(path.join(dir, "wordpress.json"), "utf8").then(
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
    stat(path.join(dir, "call-taps.json")).then((s) => s.mtimeMs, () => 0),
  ])
  return `${leads}-${sheet}-${site}-${taps}`
}
