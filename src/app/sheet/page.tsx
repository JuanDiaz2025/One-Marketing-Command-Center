import { redirect } from "next/navigation"

// The tab was called Google Sheet before; old links still work.
export default function OldSheetPage() {
  redirect("/deals")
}
