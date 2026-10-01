"use server"

import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth/session"
import { setAutoStatus } from "@/lib/leads/scoring"

// Turns automatic status from the lead score on or off (Leads page).
export async function setAutoStatusAction(on: boolean): Promise<{ error?: string }> {
  if (!(await getSession())) return { error: "Sign in first." }
  await setAutoStatus(on)
  revalidatePath("/leads")
  return {}
}
