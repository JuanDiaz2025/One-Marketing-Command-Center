"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { SESSION_COOKIE, SESSION_DAYS, newSessionToken, roleForPassword, secureCookies } from "@/lib/auth"
import { safeNext } from "@/lib/google-signin"
import { cleanName, rememberName } from "@/lib/people"
import { shared } from "@/lib/shared-state"

export type LoginState = { error?: string; name?: string }

// At most 5 wrong passwords per visitor in 15 minutes: through go-online.bat the sign-in page is on
// the internet, so the password can't be guessed by trying many. A right password always gets in,
// so nobody can lock the team out by guessing wrong on purpose.
const tries = shared("password-tries", () => ({ byVisitor: new Map<string, number[]>() }))
const WINDOW_MS = 15 * 60_000
function recent(visitor: string) {
  const since = Date.now() - WINDOW_MS
  const left = (tries.byVisitor.get(visitor) ?? []).filter((t) => t > since)
  if (left.length) tries.byVisitor.set(visitor, left)
  else tries.byVisitor.delete(visitor)
  return left
}
function noteWrong(visitor: string) {
  tries.byVisitor.set(visitor, [...recent(visitor), Date.now()])
}
// Who's trying: through the tunnel, the address Cloudflare saw (it sets cf-connecting-ip itself, so
// it can't be faked from outside); on this computer or its network, one shared "local".
async function visitorOf() {
  const h = await headers()
  return h.has("cf-ray") ? (h.get("cf-connecting-ip") ?? "tunnel") : "local"
}

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  // The name stays in the form after a wrong try.
  const name = cleanName(form.get("name"))
  const visitor = await visitorOf()
  const role = roleForPassword(String(form.get("password") ?? ""))
  if (!role) {
    if (recent(visitor).length >= 5) return { error: "Too many wrong tries. Wait 15 minutes and try again.", name }
    noteWrong(visitor)
    return { error: "That password isn't right. Ask your admin for the team password.", name }
  }
  if (name) await rememberName(name)

  ;(await cookies()).set(SESSION_COOKIE, newSessionToken(role), {
    httpOnly: true,
    secure: await secureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  })
  const next = form.get("next")
  redirect(safeNext(typeof next === "string" ? next : null))
}

export async function signOut() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/login")
}
