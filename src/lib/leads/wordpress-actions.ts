"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth/session"
import { getWordPress, normalizeSite, setWordPressSite, syncWordPress } from "@/lib/leads/wordpress"

export type WordPressFormState = { error?: string; connected?: boolean; disconnected?: boolean } | undefined

// Saves the website's address from the Leads page and checks the Lead Saver plugin answers.
export async function connectWordPressAction(_: WordPressFormState, formData: FormData): Promise<WordPressFormState> {
  await requireSession("/leads")
  if (formData.get("disconnect")) {
    await setWordPressSite(null)
    revalidatePath("/leads")
    return { disconnected: true }
  }
  const site = normalizeSite(String(formData.get("site") ?? ""))
  if (!site) return { error: "Type your website's address, e.g. twinhomebuyer.com" }
  await setWordPressSite(site)
  await syncWordPress(true)
  revalidatePath("/leads")
  const state = await getWordPress()
  return state.lastError ? { error: state.lastError } : { connected: true }
}
