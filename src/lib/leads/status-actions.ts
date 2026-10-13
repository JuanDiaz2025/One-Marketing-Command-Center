"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"

import { isSignedIn, signedInEmail } from "@/lib/auth"
import { activeAccount } from "@/lib/conversions/google"
import { sendPendingConversions, setLeadStatus } from "@/lib/conversions/offline-conversions"
import { guard } from "@/lib/guard"
import { currentName } from "@/lib/people"
import { leadStatuses, type LeadStatus } from "@/lib/leads/types"
import { shareStatuses } from "@/lib/leads/wordpress"

// Sets a lead's status from the Leads table, and sends Google Ads the conversion it means.
async function setLeadStatusActionUnguarded(id: string, status: string): Promise<{ error?: string }> {
  if (!(await isSignedIn())) return { error: "Sign in first." }
  if (!leadStatuses.some((s) => s.id === status)) return { error: "Unknown status." }
  // Who set it, for the team: the name they typed, or their Google email's name.
  const by = (await currentName()) || (await signedInEmail())?.split("@")[0] || undefined
  const lead = await setLeadStatus(id, status as LeadStatus, by)
  if (!lead) return { error: "That lead is gone." }
  // The rest of the team sees it within seconds (team-sync.ts).
  after(() => shareStatuses())
  try {
    const active = await activeAccount()
    if (active) await sendPendingConversions(active.connection, active.account)
  } catch (error) {
    console.error("Couldn't send conversions to Google Ads:", error)
  }
  revalidatePath("/leads", "layout")
  return {}
}

export async function setLeadStatusAction(id: string, status: string): Promise<{ error?: string }> {
  return guard(() => setLeadStatusActionUnguarded(id, status), (error) => ({ error }))
}
