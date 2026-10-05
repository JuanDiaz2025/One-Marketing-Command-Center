// Picks out search terms that don't fit a cash home buyer (people who aren't trying to sell a
// house) and suggests the negative keyword that would block each one.
import type { SearchTerm } from "@/lib/google/ads"

// Searches from people who want to sell a house: never flagged, whatever they cost (they're the
// ones the ads are for). Checked before the "not a seller" words, so "behind on my mortgage, sell
// house" or "sell my rental property" stay.
const SELLER =
  /\b(sell|selling|sale by owner|fsbo|we buy|buy my|buys? (houses?|homes?|propert(y|ies)|land)|cash (for|offer|buyers?|home|house|homes|houses)|(house|home|property) buyers? (near|in|for|company|companies)|companies that buy|investors? (who )?(buy|buying)|foreclos\w*|behind on (my )?(mortgage|payments)|inherit\w*|probate|as[- ]is|fixer|distressed|divorce|relocat\w*|tired landlord|code violations?|condemned|fire damage|ugly (house|home)|unwanted (house|home|property)|get rid of (my |a )?(house|home|property)|offer (on|for) my|what is my (house|home) worth|how much (is|can i get for) my (house|home))\b/i

// About a house or property at all (if not, it can't be a seller).
const PROPERTY = /\b(house|houses|home|homes|property|properties|condo|condos|townhouse|townhome|duplex|triplex|land|lot|lots|real estate|realtor|realty|mobile home|estate)\b/i

// Words that mean the searcher isn't a seller. Edit these to fit your market.
const junk: { reason: string; words: string[]; always?: boolean }[] = [
  // Flagged even next to seller words ("we buy houses jobs").
  { reason: "Job seeker", always: true, words: ["job", "jobs", "hiring", "career", "careers", "salary", "internship", "employment", "resume"] },
  { reason: "Renter", words: ["rent", "rental", "rentals", "apartment", "apartments", "lease", "leasing", "roommate", "section 8"] },
  { reason: "Home buyer, not seller", words: ["homes for sale", "houses for sale", "house for sale", "for sale near me", "buy a house", "buying a house", "buy a home", "first time home buyer", "first time homebuyer", "open house", "pre approval", "preapproval"] },
  { reason: "Wants a loan, not to sell", words: ["mortgage", "mortgages", "refinance", "refi", "heloc", "home equity", "loan", "loans", "lender", "lenders"] },
  { reason: "Research or DIY", words: ["how to", "diy", "course", "class", "classes", "license", "training", "school", "reddit", "youtube", "definition", "meaning", "what is"] },
  { reason: "Looking for free stuff", words: ["free"] },
  {
    reason: "Wants another service, not a home buyer",
    words: [
      "plumber", "plumbing", "roofer", "roofing", "electrician", "handyman", "cleaning", "movers", "moving company", "storage", "insurance",
      "remodel", "remodeling", "remodelling", "renovation", "renovations", "contractor", "contractors", "kitchen", "bathroom", "flooring",
      "painting", "painter", "landscaping", "hvac", "pest", "solar", "cabinets", "countertops", "windows", "siding", "pool", "inspection",
      "home depot", "home goods", "homegoods", "home improvement",
    ],
  },
]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const patterns = junk.flatMap(({ reason, words, always }) =>
  words.map((word) => ({ reason, word, always, re: new RegExp(`(^|\\s)${escape(word)}(\\s|$)`, "i") })),
)

export type WastedSearch = SearchTerm & {
  reason: string
  // Ready to paste into Google Ads' negative keyword box: "phrase" or [exact].
  negative: string
  // First spotted in the last day.
  isNew?: boolean
}

export type WastedSummary = ReturnType<typeof findWastedSearches>

// Identifies a search across visits: the same words in the same ad group.
export const searchKey = (t: SearchTerm) => `${t.campaign}\u0000${t.adGroup}\u0000${t.term.toLowerCase()}`

// A search that brought no leads is flagged when it doesn't fit a cash home buyer: a job seeker,
// renter, home buyer, borrower, DIY-er, someone after another trade, or a search that isn't about a
// house at all. Searches from people who want to sell are never flagged, whatever they cost.
// (`costPerConversion` only sets spendLimit, kept for callers that show it.)
export function findWastedSearches(terms: SearchTerm[], costPerConversion: number) {
  const spendLimit = Math.max(25, costPerConversion || 0)
  const wasted: WastedSearch[] = []
  for (const t of terms) {
    if (t.conversions >= 0.5 || t.cost <= 0) continue
    const always = patterns.find((p) => p.always && p.re.test(t.term))
    if (always) {
      wasted.push({ ...t, reason: always.reason, negative: `"${always.word}"` })
      continue
    }
    if (SELLER.test(t.term)) continue
    const match = patterns.find((p) => p.re.test(t.term))
    if (match) wasted.push({ ...t, reason: match.reason, negative: `"${match.word}"` })
    else if (!PROPERTY.test(t.term)) wasted.push({ ...t, reason: "Not about selling a house", negative: `[${t.term}]` })
  }
  wasted.sort((a, b) => b.cost - a.cost)
  return { wasted, spendLimit, total: wasted.reduce((sum, t) => sum + t.cost, 0) }
}

// One negative per line, without repeats, in Google Ads' paste format.
export function negativeKeywordList(wasted: WastedSearch[]) {
  return [...new Set(wasted.map((w) => w.negative))].join("\n")
}
