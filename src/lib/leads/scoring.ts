// Lead scoring: how good a seller lead looks the moment it arrives, from 0 to 100, with the
// reasons. Hot leads (70+) can be marked Interested automatically, which sends Google Ads an
// offline conversion; Junk (spam, tests, fake numbers) can be marked Not interested. That
// follows Google Ads' advice for lead forms: send back only qualified leads, so Smart Bidding
// learns to find more people like them instead of more form-fillers.
//
// Points (100 at most): a real phone number 25, an email 10, a property address with a house
// number 20, a full name 5, a paid ad click 10, a seller search ("sell my house fast") 10, a
// motivated seller in the message (inherited, foreclosure, repairs...) 15, coming back again 5.
import { jsonFileStore } from "@/lib/json-file-store"
import type { Lead, LeadGrade, LeadScore } from "@/lib/leads/types"

export const HOT_AT = 70
export const WARM_AT = 40

export const gradeLabels: Record<LeadGrade, string> = { hot: "Hot", warm: "Warm", cold: "Cold", junk: "Junk" }

type Settings = { autoStatus: boolean }
const settings = jsonFileStore<Settings>("lead-scoring.json", () => ({ autoStatus: true }))
export const getScoringSettings = () => settings.read()
export const setAutoStatus = (on: boolean) =>
  settings.update((s) => {
    s.autoStatus = on
  })

const digitsOf = (s: string) => s.replace(/\D/g, "")

// A US phone number that could be real: 10 digits (after a leading 1), a real area code, and
// not a made-up pattern like 555-0100, 1234567890 or 9999999999.
export function realPhone(phone?: string) {
  if (!phone) return false
  let d = digitsOf(phone)
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1)
  if (phone.trim().startsWith("+") && !phone.trim().startsWith("+1")) return d.length >= 8 // outside the US
  if (d.length !== 10 || /^[01]/.test(d) || /^[2-9]11/.test(d)) return false
  if (/^(\d)\1+$/.test(d) || d === "1234567890" || /^\d{3}5550[01]\d\d$/.test(d)) return false
  return true
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const THROWAWAY = /@(mailinator|guerrillamail|10minutemail|tempmail|temp-mail|yopmail|trashmail|sharklasers|getnada)\./i
const FAKE_NAME = /^(test|testing|asdf\w*|qwerty|fake|none|n\/?a|xxx+|aaa+|abc|john doe|jane doe|sample|demo)$/i
const SELLER_SEARCH = /\b(sell|selling|sold|cash|buy(ers?)? (my|houses?|homes?)|we buy|fast|quick|as[- ]is|offer|foreclos\w*|inherit\w*|probate|ugly)\b/i
const MOTIVATED =
  /\b(foreclos\w*|behind on (my )?(payments?|mortgage)|late payments?|pre-?foreclosure|inherit\w*|probate|divorc\w*|repairs?|fixer|needs work|vacant|tenants?|evict\w*|relocat\w*|moving|job transfer|downsiz\w*|tax(es)? (lien|owed)|back taxes|code violations?|fire damage|water damage|mold|asap|urgent\w*|quickly|as[- ]is|bankrupt\w*|lost (my )?job)\b/i
const SPAM_WORDS = /\b(seo|backlinks?|rank(ing)? (your|on google)|guest post|crypto|bitcoin|forex|loan offer|web ?design services|increase (your )?traffic|casino|viagra)\b/i
const LINKS = /(https?:\/\/|www\.)/gi
const SPAM_FLAG = "Contact Form 7 marked this as spam"

// Scores a lead. `earlier` are the leads that came before it, to spot someone coming back.
export function scoreLead(lead: Lead, earlier: Lead[] = []): LeadScore {
  const reasons: string[] = []
  let points = 0
  const add = (n: number, why: string) => {
    points += n
    reasons.push(`${n > 0 ? "+" : ""}${n} ${why}`)
  }
  const junk = (why: string): LeadScore => ({ value: 0, grade: "junk", reasons: [`Junk: ${why}`, ...reasons] })

  const name = lead.name.trim()
  const notes = lead.notes ?? ""
  const message = notes.replace(/^⚠.*$/m, "")
  const phoneOk = realPhone(lead.phone)
  const email = lead.email?.trim().toLowerCase()
  const emailOk = Boolean(email && EMAIL.test(email) && !THROWAWAY.test(email))

  // Clear junk first.
  if (FAKE_NAME.test(name) || /\btest\b/i.test(name) || /(https?:\/\/|www\.)/i.test(name)) return junk("looks like a test or a fake name")
  if (SPAM_WORDS.test(message)) return junk("the message is advertising, not a seller")
  if (!phoneOk && !emailOk) return junk(lead.phone || lead.email ? "the phone number and email don't look real" : "no phone number or email")

  // Contact details.
  if (phoneOk) add(25, "Real phone number")
  else if (lead.phone) add(-15, "Phone number looks fake or incomplete")
  if (emailOk) add(10, "Email address")
  else if (email && THROWAWAY.test(email)) add(-10, "Throwaway email address")

  // The property.
  const address = lead.propertyAddress?.trim() ?? ""
  if (/^\d+[a-z]?\s+\S+/i.test(address) || /\b\d{2,}\s+\w+\s+(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|way|pl|place|ter|terrace|cir|circle|hwy|pkwy)\b/i.test(address)) {
    add(20, "Property address")
  } else if (address.length >= 4) add(8, "Property area (no house number)")

  if (name.split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w)).length >= 2) add(5, "Full name")

  // Where they came from.
  const t = lead.tracking ?? {}
  if (t.gclid || /^(cpc|ppc|paid|paidsearch|paid_search)$/i.test(t.utmMedium ?? "")) add(10, "Came from a paid ad click")
  const searched = [t.utmTerm, t.utmCampaign].filter(Boolean).join(" ")
  if (SELLER_SEARCH.test(searched)) add(10, `Searched like a seller ("${(t.utmTerm || t.utmCampaign || "").slice(0, 40)}")`)

  // What they said.
  const motive = message.match(MOTIVATED)
  if (motive) add(15, `Motivated seller: mentions "${motive[0].toLowerCase()}"`)
  const links = message.match(LINKS)?.length ?? 0
  if (links) add(-30, "Message has links (often spam)")
  if (notes.includes(SPAM_FLAG)) add(-25, "Blocked as spam on the website (check it: it may be a real person)")

  // Coming back: the same phone or email as an earlier lead.
  const phone = lead.phone ? digitsOf(lead.phone).slice(-10) : ""
  const back = earlier.some(
    (l) => l.id !== lead.id && ((phone.length === 10 && l.phone && digitsOf(l.phone).slice(-10) === phone) || (email && l.email?.toLowerCase() === email)),
  )
  if (back) add(5, "Came back: sent a form before")

  const value = Math.max(0, Math.min(100, points))
  return { value, grade: value >= HOT_AT ? "hot" : value >= WARM_AT ? "warm" : "cold", reasons }
}
