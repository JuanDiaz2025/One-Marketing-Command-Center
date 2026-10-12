"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"

import { guard } from "@/lib/guard"
import { getSession } from "@/lib/auth/session"
import { senderAccount } from "@/lib/google/active-account"
import { sendPendingConversions, setLeadStatus } from "@/lib/google/offline-conversions"
import { leadStatuses, type LeadStatus } from "@/lib/leads/types"
import { shareStatuses } from "@/lib/leads/wordpress"

// Sets a lead's status from the Leads table, and sends Google Ads the conversion it means.
async function setLeadStatusActionUnguarded(id: string, status: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: "Sign in first." }
  if (!leadStatuses.some((s) => s.id === status)) return { error: "Unknown status." }
  const lead = await setLeadStatus(id, status as LeadStatus, session.name)
  if (!lead) return { error: "That lead is gone." }
  // The rest of the team sees it within seconds (team-sync.ts).
  after(() => shareStatuses())
  try {
    const active = await senderAccount(session.sub)
    if (active) await sendPendingConversions(active.connection, active.account)
  } catch (error) {
    console.error("Couldn't send conversions to Google Ads:", error)
  }
  revalidatePath("/leads")
  return {}
}

export async function setLeadStatusAction(id: string, status: string): Promise<{ error?: string }> {
  return guard(() => setLeadStatusActionUnguarded(id, status), (error) => ({ error }))
}
