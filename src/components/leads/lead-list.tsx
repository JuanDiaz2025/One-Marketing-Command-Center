import { Mail, MapPin, Phone } from "lucide-react"

import { leadSource } from "@/lib/leads/source"
import type { Lead, QrCode } from "@/lib/leads/types"

// Server-rendered pages call this once per request, so reading the clock here is fine.
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

// How many leads came in during the last `days` days.
export function countSince(leads: Lead[], days: number, now = Date.now()) {
  return leads.filter((l) => now - Date.parse(l.createdAt) < days * 86_400_000).length
}

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

export default function LeadList({ leads, qrCodes }: { leads: Lead[]; qrCodes: QrCode[] }) {
  const codeNames = new Map(qrCodes.map((c) => [c.id, c.placement]))
  return (
    <ul className="flex flex-col divide-y">
      {leads.map((lead) => (
        <li key={lead.id} className="flex flex-col gap-2 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-semibold">{lead.name}</span>
            <span className="text-xs text-muted-foreground">
              {timeAgo(lead.createdAt)} · {leadSource(lead, codeNames)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {lead.phone && (
              <a href={telHref(lead.phone)} className="inline-flex items-center gap-1.5 text-primary">
                <Phone className="size-3.5" />
                {lead.phone}
              </a>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex min-w-0 items-center gap-1.5 break-all text-primary"
              >
                <Mail className="size-3.5 shrink-0" />
                {lead.email}
              </a>
            )}
            {lead.propertyAddress && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                {lead.propertyAddress}
              </span>
            )}
          </div>
          {lead.notes && (
            <p className="text-sm whitespace-pre-line text-muted-foreground">{lead.notes}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
