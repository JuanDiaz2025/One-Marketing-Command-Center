// The key a Google Ads call is remembered by once it's been added as a lead.
export type CallInfo = { start: string; areaCode: string; campaign: string; seconds: number }
export const callIdOf = (c: Pick<CallInfo, "start" | "areaCode">) => `call:${c.start}:${c.areaCode}`

// A lead made from a phone call: a Google Ads call, or a tap on a phone number on the website
// (from PostHog, "tap:<visitor>:<id>"). You decide what Google Ads hears about it.
export const isPhoneLead = (lead: { callId?: string; inboxId?: string }) => Boolean(lead.callId || /^tap:|:tap\d+$/.test(lead.inboxId ?? ""))
