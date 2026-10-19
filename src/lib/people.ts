// Who is using DealTrack right now. Everyone shares one password per role, so steps that need a
// name on them (proving waste, approving, pushing, budget settings) use the name each person
// types once; it's kept in a cookie on their browser for a year.

import { cookies } from "next/headers"

import { signedInEmail } from "@/lib/auth"

export const NAME_COOKIE = "dt_name"

export function cleanName(value: unknown): string {
  return String(value ?? "")
    .replace(/[^\p{L}\p{N} .'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
}

// The name they typed, or else the one from the Google account they signed in with
// ("bryan.smith@…" → "Bryan Smith"), so nobody is asked for a name the app already knows.
export async function currentName(): Promise<string> {
  const typed = cleanName((await cookies()).get(NAME_COOKIE)?.value)
  if (typed) return typed
  const email = await signedInEmail().catch(() => null)
  const local = email?.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\d+/g, "").trim()
  return cleanName(local?.replace(/\b\p{L}/gu, (c) => c.toUpperCase()))
}

// Saves the name someone typed, for next time. Call from server actions only (it sets a cookie).
export async function rememberName(value: unknown): Promise<string | null> {
  const name = cleanName(value)
  // Left empty (or the box isn't on that part of the page): the name they already gave.
  if (!name) return (await currentName()) || null
  ;(await cookies()).set(NAME_COOKIE, name, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86_400 })
  return name
}
