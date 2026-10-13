"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { SESSION_COOKIE, SESSION_DAYS, newSessionToken, roleForPassword, secureCookies } from "@/lib/auth"
import { safeNext } from "@/lib/google-signin"
import { cleanName, rememberName } from "@/lib/people"
import { shared } from "@/lib/shared-state"

export type LoginState = { error?: string; name?: string }

// At most 5 wrong passwords per visitor in 15 minutes, and 30 for everyone together: through
// go-online.bat the sign-in page is on the internet, so the password can't be guessed by trying many.
const tries = shared("password-tries", () => ({ byVisitor: new Map<string, number[]>(), all: [] as number[] }))
const WINDOW_MS = 15 * 60_000
function tooManyTries(visitor: string) {
  const since = Date.now() - WINDOW_MS
  tries.all = tries.all.filter((t) => t > since)
  return (tries.byVisitor.get(visitor) ?? []).filter((t) => t > since).length >= 5 || tries.all.length >= 30
}
function noteWrong(visitor: string) {
  const since = Date.now() - WINDOW_MS
  tries.byVisitor.set(visitor, [...(tries.byVisitor.get(visitor) ?? []).filter((t) => t > since), Date.now()])
  tries.all.push(Date.now())
}

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  // The name stays in the form after a wrong try.
  const name = cleanName(form.get("name"))
  const h = await headers()
  const visitor = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"
  if (tooManyTries(visitor)) return { error: "Too many wrong tries. Wait 15 minutes and try again.", name }
  const role = roleForPassword(String(form.get("password") ?? ""))
  if (!role) {
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
