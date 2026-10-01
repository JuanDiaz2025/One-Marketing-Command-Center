"use server"

import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth/session"
import { activeAccount } from "@/lib/google/active-account"
import { sendPendingConversions, setLeadStatus } from "@/lib/google/offline-conversions"
import { leadStatuses, type LeadStatus } from "@/lib/leads/types"

// Sets a lead's status from the Leads table, and sends Google Ads the conversion it means.
export async function setLeadStatusAction(id: string, status: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: "Sign in first." }
  if (!leadStatuses.some((s) => s.id === status)) return { error: "Unknown status." }
  const lead = await setLeadStatus(id, status as LeadStatus)
  if (!lead) return { error: "That lead is gone." }
  try {
    const active = await activeAccount(session.sub)
    if (active) await sendPendingConversions(active.connection, active.account)
  } catch (error) {
    console.error("Couldn't send conversions to Google Ads:", error)
  }
  revalidatePath("/leads")
  return {}
}
