"use server"

import { createDeviceLink } from "@/lib/auth/device-link"
import { getSession } from "@/lib/auth/session"
import { guard } from "@/lib/guard"
import { tunnelUrl } from "@/lib/leads/webhook"

// The address other devices can open: a permanent one (SITE_URL), or go-online.bat's while it runs.
async function linkUnguarded(): Promise<{ url?: string; error?: string }> {
  const session = await getSession()
  if (!session) return { error: "Sign in first." }
  const base = process.env.SITE_URL?.trim().replace(/\/$/, "") || (await tunnelUrl())
  if (!base) return { error: "Double-click go-online.bat in the app's folder first (it gives the app an address your phone can open), wait for it to say the app is online, then click this again." }
  return { url: `${base}/api/auth/link?t=${await createDeviceLink(session)}` }
}

export async function createDeviceLinkAction(): Promise<{ url?: string; error?: string }> {
  return guard(() => linkUnguarded(), (error) => ({ error }))
}
