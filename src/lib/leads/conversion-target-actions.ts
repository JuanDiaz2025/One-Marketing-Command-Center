"use server"

import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth/session"
import { activeAccount } from "@/lib/google/active-account"
import { sendPendingConversions, setConversionTarget } from "@/lib/google/offline-conversions"

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
