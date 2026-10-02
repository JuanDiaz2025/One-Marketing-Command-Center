"use server"

import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth/session"
import { activeAccount } from "@/lib/google/active-account"
import { setSpreadsheet, spreadsheetIdFrom, syncSheet } from "@/lib/google/sheets-sync"

export type SheetFormState = { error?: string; ok?: string } | undefined

// Saves the spreadsheet link (or removes it) and syncs right away.
export async function sheetAction(_: SheetFormState, formData: FormData): Promise<SheetFormState> {
  const session = await getSession()
  if (!session) return { error: "Sign in first." }
  if (formData.get("disconnect")) {
    await setSpreadsheet(null)
    revalidatePath("/sheet")
    return { ok: "Disconnected. The tabs stay in your sheet; they just won't be updated." }
  }
  const link = String(formData.get("sheet") ?? "")
  if (link) {
    const id = spreadsheetIdFrom(link)
    if (!id) return { error: "That doesn't look like a Google Sheets link. Copy it from your browser's address bar while the sheet is open." }
    await setSpreadsheet(id)
  }
  try {
    const active = await activeAccount(session.sub)
    if (!active) return { error: "Connect Google Ads first, on the Google Ads page." }
    const r = await syncSheet(active.connection, active.account)
    revalidatePath("/sheet")
    return { ok: `Done: ${r.deals} deals from ${r.tabs.join(", ") || "no year tabs"}, and ${r.months} months of Google Ads campaign results.` }
  } catch (e) {
    revalidatePath("/sheet")
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
