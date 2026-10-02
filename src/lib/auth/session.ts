import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { SESSION_COOKIE } from "@/lib/auth/cookie-name"
import { seal, unseal } from "@/lib/auth/crypto"

export { SESSION_COOKIE }

// The signed-in Google user, kept in an encrypted cookie.
export type Session = {
  sub: string // Google's stable account id
  email: string
  name: string
  picture?: string
  exp: number // ms since epoch
}

const MAX_AGE_S = 30 * 24 * 60 * 60

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  // Only over https: the app on this computer (or a phone on the same Wi-Fi) uses plain http.
  secure: process.env.NODE_ENV === "production" && process.env.OMCC_LOCAL !== "1" && Boolean(process.env.SITE_URL?.startsWith("https://")),
  path: "/",
} as const

export async function sessionCookie(user: Omit<Session, "exp">) {
  const session: Session = { ...user, exp: Date.now() + MAX_AGE_S * 1000 }
  return { name: SESSION_COOKIE, value: await seal(session), maxAge: MAX_AGE_S, ...cookieOptions }
}

export async function getSession() {
  const session = await unseal<Session>((await cookies()).get(SESSION_COOKIE)?.value)
  return session && session.exp > Date.now() ? session : null
}

// For pages and server actions that only signed-in people may use. proxy.ts already sends
// visitors without a cookie to /login; this also rejects expired or tampered ones.
export async function requireSession(next = "/dashboard") {
  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`)
  return session
}
