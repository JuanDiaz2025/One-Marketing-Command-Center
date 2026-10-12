"use server"

import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth/session"
import { guard } from "@/lib/guard"
import { activeAccount } from "@/lib/google/active-account"
import { newInstallId, readTeamCode } from "@/lib/leads/team-sync"
import { setWebhookSecret } from "@/lib/leads/webhook"
import { claimSender, getWordPress, normalizeSite, setWordPressSite, syncWordPress } from "@/lib/leads/wordpress"

export type TeamFormState = { error?: string; joined?: string } | undefined

// "Join your team" on a teammate's computer: the team code from the main computer connects this
// copy to the same website, so it gets the same leads and everyone's statuses.
async function joinTeamActionUnguarded(_: TeamFormState, formData: FormData): Promise<TeamFormState> {
  if (!(await getSession())) return { error: "Sign in first." }
  const team = readTeamCode(String(formData.get("code") ?? ""))
  const site = team && normalizeSite(team.site)
  if (!team || !site) return { error: "That isn't a team code. Copy it again from the Leads page on the main computer (Website leads → Your team)." }
  await setWebhookSecret(team.key)
  await newInstallId()
  await setWordPressSite(site)
  await syncWordPress(true)
  revalidatePath("/leads")
  const state = await getWordPress()
  return state.lastError ? { error: state.lastError } : { joined: site.replace(/^https?:\/\//, "") }
}

export async function joinTeamAction(state: TeamFormState, formData: FormData): Promise<TeamFormState> {
  return guard(() => joinTeamActionUnguarded(state, formData), (error) => ({ error }))
}

// "Send to Google Ads from this computer": moves that job here (e.g. a new main computer).
async function takeSenderActionUnguarded(): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: "Sign in first." }
  const active = await activeAccount(session.sub)
  if (!active) return { error: "Connect Google Ads on this computer first (Google Ads page)." }
  const sender = await claimSender(active.connection.email, true)
  if (!sender) return { error: "Couldn't reach your website. Try again in a moment." }
  revalidatePath("/leads")
  return {}
}

export async function takeSenderAction(): Promise<{ error?: string }> {
  return guard(() => takeSenderActionUnguarded(), (error) => ({ error }))
}
