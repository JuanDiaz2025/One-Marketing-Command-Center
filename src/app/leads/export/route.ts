import { getSession } from "@/lib/auth/session"
import { listLeads, listQrCodes } from "@/lib/leads/store"

// Quote every cell, and stop spreadsheet apps from running a value that starts like a formula.
function cell(value: string | undefined) {
  const text = value ?? ""
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

// GET /leads/export → every lead as a CSV file.
export async function GET() {
  if (!(await getSession())) return new Response("Sign in first.", { status: 401 })
  const [leads, qrCodes] = await Promise.all([listLeads(), listQrCodes()])
  const placements = new Map(qrCodes.map((c) => [c.id, c.placement]))

  const rows = [
    ["Date", "Name", "Phone", "Email", "Property address", "Notes", "QR code"],
    ...leads.map((l) => [
      l.createdAt,
      l.name,
      l.phone,
      l.email,
      l.propertyAddress,
      l.notes,
      placements.get(l.qrCodeId),
    ]),
  ]
  const csv = rows.map((r) => r.map(cell).join(",")).join("\r\n")
  const date = new Date().toISOString().slice(0, 10)
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  })
}
