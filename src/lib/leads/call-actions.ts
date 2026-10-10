"use server"

// A phone call from a Google Ads ad turned into a lead. Calls carry no Google click ID (Google only
// shares the time, length and area code), so the lead is matched to the ad click by the caller's
// phone number instead, the way Google matches form leads without a click ID.
import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth/session"
import { runQuery } from "@/lib/google/ads"
import { activeAccount } from "@/lib/google/active-account"
import { sendPendingConversions } from "@/lib/google/offline-conversions"
import { callIdOf, type CallInfo } from "@/lib/leads/call-id"
import { callQuestions, cleanAnswers, scoreCall, type CallAnswers } from "@/lib/leads/motivation"
import { applyStatus } from "@/lib/leads/status"
import { addLead, listLeads, updateLead } from "@/lib/leads/store"
import { leadStatuses, type Lead, type LeadStatus, type Motivation } from "@/lib/leads/types"


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
  const answers = cleanAnswers(input.answers, input.notes)
  const motivation = await scoreCall(answers)
  // "Decide from the score": Hot → Interested (Google Ads hears a qualified lead), not a seller →
  // Not interested (reported as an invalid lead), anything else stays New for you to follow up.
  const auto = input.status === "auto"
  const status: LeadStatus = !auto ? (input.status as LeadStatus) : motivation.grade === "hot" ? "interested" : motivation.grade === "junk" ? "not_interested" : "new"

  const active = await activeAccount(session.sub).catch(() => null)
  const at = active ? await callTime(call.start, active) : new Date(call.start.replace(" ", "T"))
  const lead = await addLead(
    {
      name: (typeof input.name === "string" ? input.name.trim().slice(0, 100) : "") || `Caller from (${call.areaCode || "?"})`,
      phone: input.phone.trim().slice(0, 30),
      notes: [
        `Phone call from Google Ads, ${Math.round(call.seconds / 60)} min.`,
        ...(Object.keys(callQuestions) as (keyof typeof callQuestions)[])
          .filter((q) => answers[q])
          .map((q) => `${callQuestions[q].label}: ${(callQuestions[q].options as readonly (readonly [string, string])[]).find(([k]) => k === answers[q])?.[1] ?? answers[q]}`),
        answers.notes,
      ]
        .filter(Boolean)
        .join("\n"),
      source: "Google Ads phone call",
      tracking: { utmSource: "google", utmMedium: "cpc", utmCampaign: call.campaign || undefined },
      callId,
      motivation,
    },
    Number.isNaN(at.getTime()) ? undefined : at.toISOString(),
  )
  // Sent twice (a refresh while it was scoring): the first one already added it.
  if (lead.motivation?.at !== motivation.at) return { error: "This call is already a lead." }
  // The score's choice counts as the app's, not yours (the leads table shows it as automatic).
  if (status !== "new") await updateLead(lead.id, (l) => applyStatus(l, status, auto ? "auto" : "you"))
  let sentNow: Lead | null = null
  try {
    if (active) await sendPendingConversions(active.connection, active.account)
    sentNow = (await listLeads()).find((l) => l.id === lead.id) ?? null
  } catch (error) {
    console.error("Couldn't send conversions to Google Ads:", error)
  }
  revalidatePath("/leads")
  const label = { hot: "Hot", warm: "Warm", cold: "Cold", junk: "Not a seller" }[motivation.grade]
  // What Google Ads actually heard (or will), from the lead itself.
  const c = sentNow?.conversions ?? {}
  const sent = c.interested || c.closed ? " Sent to Google Ads as a qualified lead, matched by the phone number." : c.invalid ? " Reported to Google Ads as not a seller." : ""
  return { ok: `Motivation ${motivation.value} (${label}). Added to your leads.${sent}`, motivation }
}
