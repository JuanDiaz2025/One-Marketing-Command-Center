import { cookies } from "next/headers"
import type { NextRequest } from "next/server"

import { redeemDeviceLink } from "@/lib/auth/device-link"
import { redirectTo } from "@/lib/auth/local-url"
import { sessionCookie } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

// A one-time sign-in link from "Open on another device" (device-link.ts).
export async function GET(request: NextRequest) {
  const user = await redeemDeviceLink(request.nextUrl.searchParams.get("t") ?? "")
  if (!user) return redirectTo("/login?error=link")
  ;(await cookies()).set(await sessionCookie(user))
  return redirectTo("/leads")
}
