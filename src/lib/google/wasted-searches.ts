// Picks out search terms that don't fit a cash home buyer (people who aren't trying to sell a
// house) and suggests the negative keyword that would block each one.
import type { SearchTerm } from "@/lib/google/ads"

// About a house or property at all (a seller always is). "Real estate", not "estate" ("estate
// sale", "estate attorney"); "land", not "lot".
const PROPERTY = /\b(house|houses|home|homes|property|properties|condo|condos|townhouse|townhome|duplex|triplex|land|real estate|realtor|realty|mobile home)\b/i

// Wants to sell (or sell to a buyer like us): seller words next to a property word, so "sell my
// car" or "cash for gold" don't count. Also written without spaces, and home-buying companies'
// names, which sellers search.
const SELL_TALK = /\b(sell|selling|sold|we buy|who buys?|that buys?|companies that buy|buy my|buys (houses?|homes?)|cash (for|offer|buyers?)|instant offer|(house|home|property) buyers?)\b/i
const SELLER_NAMES = /(webuy\w*houses|webuy\w*homes|sellmyhouse|sellmyhome|cashforhouses|opendoor|offerpad|homevestors|ugly ?houses?)/i
// Reasons people sell, that mean a seller even without a property word.
const SELLER_SITUATION =
  /\b(behind on (my )?(mortgage|payments)|(stop|stopping|avoid|avoiding) foreclosure|pre-?foreclosure|tired (of being a )?landlord|(bad|problem) tenants?|short sale|code violations?|condemned (house|home|property)?|(fire|water) damaged? (house|home|property))\b/i
// Reasons people sell, when it's about a house: "inherited house", "divorce house", "as is home".
const SELLER_REASON = /\b(inherit\w*|probate|divorc\w*|as[- ]is|fixer|distressed|relocat\w*|ugly|unwanted|foreclos\w*|get rid of|what is my|how much is my|worth)\b/i
// Shopping for a home, even when the words sound like a seller's: "foreclosed homes for sale",
// "fixer upper homes for sale", "buy house cash".
const BUYER = /\b(for sale|foreclosures? near me|foreclosed (homes?|houses?|properties)|foreclosure (listings?|auctions?)|bank owned|reo|buy(ing)? (a |an )?(house|home|houses|homes|property|condo|land)|open house|first time home ?buyers?|pre-?approv\w*)\b/i

// Words that mean the searcher isn't a seller. Edit these to fit your market.
const junk: { reason: string; words: string[]; always?: boolean }[] = [
  // Flagged even next to seller words ("we buy houses jobs").
  { reason: "Job seeker", always: true, words: ["job", "jobs", "hiring", "career", "careers", "salary", "internship", "employment", "resume"] },
  { reason: "Renter", words: ["rent", "rental", "rentals", "apartment", "apartments", "lease", "leasing", "roommate", "section 8"] },
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
    const term = t.term
    const flag = (reason: string, negative: string) => wasted.push({ ...t, reason, negative })
    // Job seekers, even next to seller words ("we buy houses jobs"), but not "job relocation".
    const job = patterns.find((p) => p.always && p.re.test(term))
    if (job && !/relocat/i.test(term)) {
      flag(job.reason, `"${job.word}"`)
      continue
    }
    // Buying their first home, though "home buyer" sounds like us.
    if (/\b(first[- ]time (home ?)?buyers?|pre-?approv\w*)\b/i.test(term)) {
      flag("Home buyer, not seller", `"first time home buyer"`)
      continue
    }
    const property = PROPERTY.test(term)
    if ((SELL_TALK.test(term) && property) || SELLER_NAMES.test(term.replace(/\s+/g, ""))) continue
    if (BUYER.test(term)) {
      flag("Home buyer, not seller", `[${term}]`)
      continue
    }
    if (SELLER_SITUATION.test(term) || (property && SELLER_REASON.test(term))) continue
    const match = patterns.find((p) => !p.always && p.re.test(term))
    if (match) flag(match.reason, `"${match.word}"`)
    else if (!property) flag("Not about selling a house", `[${term}]`)
  }
  wasted.sort((a, b) => b.cost - a.cost)
  return { wasted, spendLimit, total: wasted.reduce((sum, t) => sum + t.cost, 0) }
}

// One negative per line, without repeats, in Google Ads' paste format.
export function negativeKeywordList(wasted: WastedSearch[]) {
  return [...new Set(wasted.map((w) => w.negative))].join("\n")
}
