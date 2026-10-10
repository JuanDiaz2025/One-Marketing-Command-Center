"use server"

// A phone call from a Google Ads ad turned into a lead. Calls carry no Google click ID (Google only
// shares the time, length and area code), so the lead is matched to the ad click by the caller's
// phone number instead, the way Google matches form leads without a click ID.
import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth/session"
import { runQuery } from "@/lib/google/ads"
import { activeAccount } from "@/lib/google/active-account"
import { sendPendingConversions, setLeadStatus } from "@/lib/google/offline-conversions"
import { callIdOf, type CallInfo } from "@/lib/leads/call-id"
import { callQuestions, scoreCall, type CallAnswers } from "@/lib/leads/motivation"
import { addLead, listLeads, updateLead } from "@/lib/leads/store"
import { leadStatuses, type LeadStatus, type Motivation } from "@/lib/leads/types"


// "2026-09-06 08:11:00" is in the Google Ads account's time zone; turn it into the real moment.
async function callTime(start: string, { connection, account }: NonNullable<Awaited<ReturnType<typeof activeAccount>>>) {
  const local = new Date(`${start.replace(" ", "T")}Z`) // the wall-clock time, read as if UTC
  if (Number.isNaN(local.getTime())) return local
  try {
    const [row] = (await runQuery(connection, account, "SELECT customer.time_zone FROM customer LIMIT 1")) as { customer?: { timeZone?: string } }[]
    const zone = row?.customer?.timeZone
    if (!zone) throw new Error("no time zone")
    // The zone's offset from UTC at that moment (e.g. -7 hours for California in summer).
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
        .formatToParts(local)
        .map((p) => [p.type, p.value]),
    )
    const asZone = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
    return new Date(local.getTime() - (asZone - local.getTime()))
  } catch {
    return new Date(start.replace(" ", "T")) // this computer's time zone
  }
}

export async function addCallLeadAction(
  call: CallInfo,
  input: { phone: string; name: string; status: string; notes: string; answers?: CallAnswers },
): Promise<{ error?: string; ok?: string; motivation?: Motivation }> {
  const session = await getSession()
  if (!session) return { error: "Sign in first." }
  const digits = input.phone.replace(/\D/g, "")
  if (digits.length < 10) return { error: "Type the caller's full phone number (with area code)." }
  if (input.status !== "auto" && !leadStatuses.some((s) => s.id === input.status)) return { error: "Pick a status." }
  const callId = callIdOf(call)
  if ((await listLeads()).some((l) => l.callId === callId)) return { error: "This call is already a lead." }

  // How motivated the caller is, from the quick answers and notes (AI when set up).
  const answers: CallAnswers = { ...input.answers, notes: input.notes }
  const motivation = await scoreCall(answers)
  // "Decide from the score": Hot → Interested (Google Ads hears a qualified lead), not a seller →
  // Not interested (reported as an invalid lead), anything else stays New for you to follow up.
  const status: LeadStatus =
    input.status !== "auto" ? (input.status as LeadStatus) : motivation.grade === "hot" ? "interested" : motivation.grade === "junk" ? "not_interested" : "new"

  const active = await activeAccount(session.sub).catch(() => null)
  const at = active ? await callTime(call.start, active) : new Date(call.start.replace(" ", "T"))
  const lead = await addLead(
    {
      name: input.name.trim() || `Caller from (${call.areaCode || "?"})`,
      phone: input.phone.trim(),
      notes: [
        `Phone call from Google Ads, ${Math.round(call.seconds / 60)} min.`,
        ...(Object.keys(callQuestions) as (keyof typeof callQuestions)[])
          .filter((q) => answers[q])
          .map((q) => `${callQuestions[q].label}: ${(callQuestions[q].options as readonly (readonly [string, string])[]).find(([k]) => k === answers[q])?.[1] ?? answers[q]}`),
        input.notes.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
      motivation,
      source: "Google Ads phone call",
      tracking: { utmSource: "google", utmMedium: "cpc", utmCampaign: call.campaign || undefined },
      callId,
    },
    Number.isNaN(at.getTime()) ? undefined : at.toISOString(),
  )
  await updateLead(lead.id, (l) => {
    l.callId = callId
  })
  if (status !== "new") await setLeadStatus(lead.id, status)
  try {
    if (active) await sendPendingConversions(active.connection, active.account)
  } catch (error) {
    console.error("Couldn't send conversions to Google Ads:", error)
  }
  revalidatePath("/leads")
  const label = { hot: "Hot", warm: "Warm", cold: "Cold", junk: "Not a seller" }[motivation.grade]
  const sent = status === "new" ? "" : status === "not_interested" ? " Reported to Google Ads as not a seller." : " Sent to Google Ads as a qualified lead, matched by the phone number."
  return { ok: `Motivation ${motivation.value} (${label}). Added to your leads.${sent}`, motivation }
}
