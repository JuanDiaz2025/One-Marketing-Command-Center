"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth/session"
import { isInboxUrl, setInboxUrl, syncInbox } from "@/lib/leads/inbox"

export type InboxFormState = { error?: string; saved?: boolean } | undefined

// Saves the Google Sheet inbox's address from the Leads page, then pulls in what's there.
export async function saveInboxAction(_: InboxFormState, formData: FormData): Promise<InboxFormState> {
  await requireSession("/leads")
  const url = String(formData.get("url") ?? "").trim().replace(/\?.*$/, "")
  if (!isInboxUrl(url)) {
    return { error: "That isn't a Google Apps Script web app address. It should look like https://script.google.com/macros/s/…/exec" }
  }
  await setInboxUrl(url)
  await syncInbox(true)
  revalidatePath("/leads")
  return { saved: true }
}
