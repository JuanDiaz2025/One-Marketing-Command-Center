"use server"

// A phone call from a Google Ads ad turned into a lead. Calls carry no Google click ID (Google only
// shares the time, length and area code), so the lead is matched to the ad click by the caller's
// phone number instead, the way Google matches form leads without a click ID.
import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth/session"
import { activeAccount } from "@/lib/google/active-account"
import { sendPendingConversions, setLeadStatus } from "@/lib/google/offline-conversions"
import { callIdOf, type CallInfo } from "@/lib/leads/call-id"
import { addLead, listLeads, updateLead } from "@/lib/leads/store"
import { leadStatuses, type LeadStatus } from "@/lib/leads/types"


export async function addCallLeadAction(
  call: CallInfo,
  input: { phone: string; name: string; status: string; notes: string },
): Promise<{ error?: string; ok?: string }> {
  const session = await getSession()
  if (!session) return { error: "Sign in first." }
  const digits = input.phone.replace(/\D/g, "")
  if (digits.length < 10) return { error: "Type the caller's full phone number (with area code)." }
  if (!leadStatuses.some((s) => s.id === input.status)) return { error: "Pick a status." }
  const callId = callIdOf(call)
  if ((await listLeads()).some((l) => l.callId === callId)) return { error: "This call is already a lead." }

  // "2026-09-06 08:11:00" is in the Google Ads account's time zone, the same as this computer's.
  const at = new Date(call.start.replace(" ", "T"))
  const lead = await addLead(
    {
      name: input.name.trim() || `Caller from (${call.areaCode || "?"})`,
      phone: input.phone.trim(),
      notes: [`Phone call from Google Ads, ${Math.round(call.seconds / 60)} min.`, input.notes.trim()].filter(Boolean).join("\n"),
      source: "Google Ads phone call",
      tracking: { utmSource: "google", utmMedium: "cpc", utmCampaign: call.campaign || undefined },
      callId,
    },
    Number.isNaN(at.getTime()) ? undefined : at.toISOString(),
  )
  await updateLead(lead.id, (l) => {
    l.callId = callId
  })
  if (input.status !== "new") await setLeadStatus(lead.id, input.status as LeadStatus)
  try {
    const active = await activeAccount(session.sub)
    if (active) await sendPendingConversions(active.connection, active.account)
  } catch (error) {
    console.error("Couldn't send conversions to Google Ads:", error)
  }
  revalidatePath("/leads")
  return { ok: input.status === "new" ? "Added to your leads." : "Added to your leads and sent to Google Ads, matched by the phone number." }
}
