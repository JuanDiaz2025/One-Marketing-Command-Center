"use server"

import { readFile } from "node:fs/promises"
import path from "node:path"

import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth/session"
import { activeAccount } from "@/lib/google/active-account"
import { checkSending, retryNow, sendPendingConversions, setConversionTarget, type CheckStep } from "@/lib/google/offline-conversions"

// Picks which Google Ads conversion action a lead stage is sent to (Leads page).
export async function setConversionTargetAction(kind: string, resourceName: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: "Sign in first." }
  if (kind !== "interested" && kind !== "closed") return { error: "Unknown stage." }
  try {
    const active = await activeAccount(session.sub)
    if (!active) return { error: "Connect Google Ads first." }
    await setConversionTarget(active.connection, active.account, kind, resourceName)
    void sendPendingConversions(active.connection, active.account).catch(() => {})
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't save that." }
  }
  revalidatePath("/leads")
  return {}
}

// "Check sending to Google Ads" on the Leads page: which version of the app this is, then each
// thing sending needs, in order.
export async function checkSendingAction(): Promise<{ steps: CheckStep[] }> {
  const session = await getSession()
  if (!session) return { steps: [{ ok: false, title: "Signed in", detail: "Sign in first." }] }
  let version = "unknown"
  try {
    version = (await readFile(path.join(process.cwd(), ".data", "app-version"), "utf8")).trim().slice(0, 7) || version
  } catch {}
  const steps: CheckStep[] = [{ ok: true, title: "App version", detail: `${version}. If something below fails, close the app and start it with start.bat to get the latest version first.` }]
  // The app's Google sign-in client ID starts with its Google Cloud project's number: that's the
  // project Google checks for the Data Manager API.
  const project = process.env.GOOGLE_CLIENT_ID?.trim().match(/^(\d+)-/)?.[1]
  if (project) {
    steps.push({
      ok: true,
      title: "Google Cloud project",
      detail: `${project} (your app's Google sign-in belongs to it). The Data Manager API must be on in this project, not another one: https://console.cloud.google.com/apis/library/datamanager.googleapis.com?project=${project}`,
    })
  }
  try {
    const active = await activeAccount(session.sub)
    if (!active) return { steps: [...steps, { ok: false, title: "Google Ads connected", detail: "Google Ads isn't connected. Connect it on the Google Ads page." }] }
    return { steps: [...steps, ...(await checkSending(active.connection, active.account))] }
  } catch (error) {
    return { steps: [...steps, { ok: false, title: "Google Ads connected", detail: error instanceof Error ? error.message : String(error) }] }
  }
}

// "Try again now": sends every waiting or failed lead again right away.
export async function retryNowAction(): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: "Sign in first." }
  try {
    const active = await activeAccount(session.sub)
    if (!active) return { error: "Connect Google Ads first." }
    await retryNow(active.connection, active.account)
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  revalidatePath("/leads")
  return {}
}
