import { randomBytes } from "node:crypto"
import { cookies } from "next/headers"

import { seal, unseal } from "@/lib/auth/crypto"
import { cookieOptions } from "@/lib/auth/session"
import type { OAuthIntent } from "@/lib/google/oauth"

// What the callback needs to finish a sign-in: kept in a short-lived encrypted cookie so a
// callback that didn't start here (a forged or replayed link) is rejected.
export type OAuthState = {
  state: string
  verifier: string
  intent: OAuthIntent
  next: string
}

const STATE_COOKIE = "omcc_oauth"

export const newState = () => randomBytes(16).toString("base64url")

export async function saveOAuthState(value: OAuthState) {
  ;(await cookies()).set(STATE_COOKIE, await seal(value), { ...cookieOptions, maxAge: 600 })
}

export async function takeOAuthState() {
  const jar = await cookies()
  const value = await unseal<OAuthState>(jar.get(STATE_COOKIE)?.value)
  jar.delete(STATE_COOKIE)
  return value
}

// Only same-site paths, so a crafted ?next= can't send people to another website.
export function safeNext(next: string | null | undefined, fallback = "/dashboard") {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : fallback
}
