import type { ConversionKind, Lead, LeadStatus } from "@/lib/leads/types"

// Which conversions each status means for Google Ads. A deal can close without "Interested"
// being set first; Google still hears about both.
const KINDS: Partial<Record<LeadStatus, ConversionKind[]>> = {
  interested: ["interested"],
  appointment: ["interested"],
  offer: ["interested"],
  closed: ["interested", "closed"],
}

// Sets a lead's status and queues the conversions it means (sent by offline-conversions.ts).
// `by` says whether you chose it or the app did from the lead's score.
export function applyStatus(lead: Lead, status: LeadStatus, by: "auto" | "you", now = new Date().toISOString()) {
  lead.status = status
  lead.statusChangedAt = now
  lead.statusBy = by
  if (by === "you") delete lead.statusRule
  for (const kind of KINDS[status] ?? []) {
    lead.conversions ??= {}
    // Once sent, a conversion stays sent; a failed one is tried again when set again.
    const entry = lead.conversions[kind]
    if (!entry || entry.state === "failed" || entry.state === "skipped") lead.conversions[kind] = { state: "pending", at: now }
  }
}

// Queues what a Google Ads rule decided, without touching the lead's status.
export function applyRule(lead: Lead, rule: { name: string; then: "qualified" | "converted" | "dont_send"; value?: number }, now = new Date().toISOString()) {
  if (rule.then === "dont_send") {
    lead.googleBlockedBy = rule.name
    return
  }
  const kinds: ConversionKind[] = rule.then === "converted" ? ["interested", "closed"] : ["interested"]
  lead.conversions ??= {}
  for (const kind of kinds) {
    // A converted lead also counts as qualified; the value goes with the conversion the rule is
    // about, so Google doesn't count it twice.
    const value = rule.then === "converted" && kind === "interested" ? undefined : rule.value
    if (!lead.conversions[kind]) lead.conversions[kind] = { state: "pending", at: now, value, rule: rule.name }
  }
}
