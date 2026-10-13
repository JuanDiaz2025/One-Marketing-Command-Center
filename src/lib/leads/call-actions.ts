"use server"

// A phone call from a Google Ads ad turned into a lead. Calls carry no Google click ID (Google only
// shares the time, length and area code), so the lead is matched to the ad click by the caller's
// phone number instead, the way Google matches form leads without a click ID.
import { revalidatePath } from "next/cache"

import { guard } from "@/lib/guard"
import { getSession } from "@/lib/auth/session"
import { runQuery } from "@/lib/google/ads"
import { senderAccount } from "@/lib/google/active-account"
import { sendPendingConversions } from "@/lib/google/offline-conversions"
import { callIdOf, type CallInfo } from "@/lib/leads/call-id"
import { formatPhone, listTaps } from "@/lib/leads/call-taps"
import { callQuestions, cleanAnswers, scoreCall, type CallAnswers } from "@/lib/leads/motivation"
import { applyStatus } from "@/lib/leads/status"
import { addLead, listLeads, updateLead } from "@/lib/leads/store"
import { googleClick, pagePath } from "@/lib/leads/tracking"
import { leadStatuses, type Lead, type LeadStatus, type Motivation } from "@/lib/leads/types"
import { getWordPress } from "@/lib/leads/wordpress"


type CallInput = { phone: string; name: string; status: string; notes: string; answers?: CallAnswers }

// "2026-09-06 08:11:00" is in the Google Ads account's time zone; turn it into the real moment.
async function callTime(start: string, { connection, account }: NonNullable<Awaited<ReturnType<typeof senderAccount>>>) {
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

type Result = { error?: string; ok?: string; motivation?: Motivation }

// Where the call came from: a Google Ads call, or a tap on a phone number on the website.
type CallSource = {
  key: Pick<Lead, "callId" | "inboxId">
  at?: Date
  defaultName: string
  firstNote: string
  source: string
  tracking?: Lead["tracking"]
  // How Google Ads matches it, for the message.
  matchedBy: string
}

// Scores the caller and adds them as a lead; Google Ads hears about it like any other lead.
async function addPhoneLead(sub: string, input: CallInput, from: CallSource): Promise<Result> {
  const digits = input.phone.replace(/\D/g, "")
  if (digits.length < 10) return { error: "Type the caller's full phone number (with area code)." }
  if (input.status !== "auto" && !leadStatuses.some((s) => s.id === input.status)) return { error: "Pick a status." }
  const same = (l: Lead) => Boolean((from.key.callId && l.callId === from.key.callId) || (from.key.inboxId && l.inboxId === from.key.inboxId))
  if ((await listLeads()).some(same)) return { error: "This call is already a lead." }

  // How motivated the caller is, from the quick answers and notes (AI when set up).
  const answers = cleanAnswers(input.answers, input.notes)
  const motivation = await scoreCall(answers)
  // "Decide from the score": Hot → Interested (Google Ads hears a qualified lead), not a seller →
  // Not interested (reported as an invalid lead), anything else stays New for you to follow up.
  const auto = input.status === "auto"
  const status: LeadStatus = !auto ? (input.status as LeadStatus) : motivation.grade === "hot" ? "interested" : motivation.grade === "junk" ? "not_interested" : "new"

  const active = await senderAccount(sub)
  const lead = await addLead(
    {
      name: (typeof input.name === "string" ? input.name.trim().slice(0, 100) : "") || from.defaultName,
      phone: input.phone.trim().slice(0, 30),
      notes: [
        from.firstNote,
        ...(Object.keys(callQuestions) as (keyof typeof callQuestions)[])
          .filter((q) => answers[q])
          .map((q) => `${callQuestions[q].label}: ${(callQuestions[q].options as readonly (readonly [string, string])[]).find(([k]) => k === answers[q])?.[1] ?? answers[q]}`),
        answers.notes,
      ]
        .filter(Boolean)
        .join("\n"),
      source: from.source,
      tracking: from.tracking,
      ...from.key,
      motivation,
    },
    from.at && !Number.isNaN(from.at.getTime()) ? from.at.toISOString() : undefined,
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
  const good = c.closed ?? c.interested
  const told = (e: typeof good, done: string, what: string) =>
    !e
      ? ""
      : e.state === "sent"
        ? ` ${done}`
        : e.state === "failed"
          ? ` Couldn't send it to Google Ads yet (${what}); the Leads page shows why, and it's tried again.`
          : e.state === "pending"
            ? active
              ? ` It will be sent to Google Ads (${what}) shortly.`
              : ` It will be sent to Google Ads (${what}) once Google Ads is connected.`
            : ""
  const sent = good
    ? told(good, `Sent to Google Ads as a qualified lead, matched by ${from.matchedBy}.`, "as a qualified lead")
    : told(c.invalid, "Reported to Google Ads as not a seller.", "as not a seller")
  // The same person may also have sent the form (a separate lead): say so, so it isn't worked, or
  // marked Interested, twice.
  const also = (await listLeads()).find(
    (l) => l.id !== lead.id && l.phone?.replace(/\D/g, "").slice(-10) === digits.slice(-10) && Math.abs(Date.parse(l.createdAt) - Date.parse(lead.createdAt)) < 7 * 86_400_000,
  )
  const note = also ? ` Note: ${also.name} has the same phone number in your leads; it may be the same person.` : ""
  return { ok: `Motivation ${motivation.value} (${label}). Added to your leads.${sent}${note}`, motivation }
}

async function addCallLeadActionUnguarded(call: CallInfo, input: CallInput): Promise<Result> {
  const session = await getSession()
  if (!session) return { error: "Sign in first." }
  const active = await senderAccount(session.sub)
  return addPhoneLead(session.sub, input, {
    key: { callId: callIdOf(call) },
    at: active ? await callTime(call.start, active) : new Date(call.start.replace(" ", "T")),
    defaultName: `Caller from (${call.areaCode || "?"})`,
    firstNote: `Phone call from Google Ads, ${Math.round(call.seconds / 60)} min.`,
    source: "Google Ads phone call",
    tracking: { utmSource: "google", utmMedium: "cpc", utmCampaign: call.campaign || undefined },
    matchedBy: "the phone number",
  })
}

// A tap on a phone number on the website, added as a lead: it keeps where the visitor came from,
// so Google Ads matches it to the very ad click when there was one.
async function addTapLeadActionUnguarded(tapId: number, input: CallInput): Promise<Result> {
  const session = await getSession()
  if (!session) return { error: "Sign in first." }
  const tap = (await listTaps()).find((t) => t.id === tapId)
  const { site } = await getWordPress()
  if (!tap || !site) return { error: "That call isn't in the list any more. Reload the page." }
  const host = new URL(site).host.replace(/^www\./, "")
  return addPhoneLead(session.sub, input, {
    // Shared with the team like the site's form leads (team-sync.ts).
    key: { inboxId: `wp:${host}:tap${tap.id}` },
    at: new Date(tap.at),
    defaultName: "Caller from the website",
    firstNote: `Called from the website: tapped ${formatPhone(tap.number)}${tap.page ? ` on ${pagePath(tap.page)}` : ""}${tap.mobile ? " (phone)" : ""}.`,
    source: "Website phone call",
    tracking: tap.tracking,
    matchedBy: googleClick(tap.tracking) ? "the Google ad click" : "the phone number",
  })
}

export async function addTapLeadAction(tapId: number, input: CallInput): Promise<Result> {
  return guard(() => addTapLeadActionUnguarded(tapId, input), (error) => ({ error }))
}

export async function addCallLeadAction(call: CallInfo, input: CallInput): Promise<Result> {
  return guard(() => addCallLeadActionUnguarded(call, input), (error) => ({ error }))
}
