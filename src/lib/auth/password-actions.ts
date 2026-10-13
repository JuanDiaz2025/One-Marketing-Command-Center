"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { safeNext } from "@/lib/auth/oauth-state"
import { checkPassword, hasPassword, setPassword, tooManyTries } from "@/lib/auth/password"
import { getSession, sessionCookie } from "@/lib/auth/session"
import { connectedPeople, getConnection } from "@/lib/google/connections"

export type PasswordState = { error?: string; name?: string } | undefined

// Signs in with the team password. The person is signed in as the team's Google Ads owner (so the
// Google Ads page works), with the name they typed, which the team sees on the statuses they set.
export async function passwordSignInAction(_: PasswordState, formData: FormData): Promise<PasswordState> {
  // The name stays in the form after a wrong try.
  const typed = String(formData.get("name") ?? "").trim().slice(0, 60)
  if (!(await hasPassword())) return { error: "No team password is set.", name: typed }
  const h = await headers()
  const visitor = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"
  if (tooManyTries(visitor)) return { error: "Too many wrong tries. Wait 15 minutes and try again.", name: typed }
  const password = String(formData.get("password") ?? "")
  if (!password || !(await checkPassword(password, visitor))) return { error: "That password isn't right.", name: typed }
  const name = typed || "Team"
  const owner = (await connectedPeople())[0]
  const connection = owner ? await getConnection(owner) : null
  ;(await cookies()).set(
    await sessionCookie({ sub: owner ?? "team-password", email: connection?.email ?? "team", name, via: "password" }),
  )
  redirect(safeNext(String(formData.get("next") ?? "") || undefined))
}

export type SetPasswordState = { error?: string; saved?: boolean } | undefined

// Sets or changes the team password: only someone signed in with Google (on this computer).
export async function setPasswordAction(_: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const session = await getSession()
  if (!session || session.via) return { error: "Only someone signed in with Google can set the team password." }
  const password = String(formData.get("password") ?? "")
  if (password.length < 8) return { error: "Use at least 8 characters." }
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords aren't the same." }
  await setPassword(password)
  return { saved: true }
}
