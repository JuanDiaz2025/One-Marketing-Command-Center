// Picks out search terms that cost money without bringing in leads, and suggests the negative
// keyword that would block each one. Tuned for a cash home buyer: the searches worth paying for
// come from people who want to sell a house, not rent, buy, or find a job.
import type { SearchTerm } from "@/lib/google/ads"

// Words that almost always mean the searcher isn't a seller. Edit these to fit your market.
const junk: { reason: string; words: string[] }[] = [
  { reason: "Job seeker", words: ["job", "jobs", "hiring", "career", "careers", "salary", "internship", "employment", "resume"] },
  { reason: "Renter", words: ["rent", "rental", "rentals", "apartment", "apartments", "lease", "leasing", "roommate", "section 8"] },
  { reason: "Home buyer, not seller", words: ["homes for sale", "houses for sale", "house for sale", "for sale near me", "buy a house", "buying a house", "first time home buyer", "mortgage", "pre approval", "preapproval"] },
  { reason: "Research or DIY", words: ["how to", "diy", "course", "class", "classes", "license", "training", "school", "reddit", "youtube", "definition", "meaning", "what is"] },
  { reason: "Looking for free stuff", words: ["free"] },
  { reason: "Wrong service", words: ["plumber", "roofer", "electrician", "handyman", "cleaning", "movers", "storage", "insurance"] },
]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const patterns = junk.flatMap(({ reason, words }) =>
  words.map((word) => ({ reason, word, re: new RegExp(`(^|\\s)${escape(word)}(\\s|$)`, "i") })),
)

export type WastedSearch = SearchTerm & {
  reason: string
  // Ready to paste into Google Ads' negative keyword box: "phrase" or [exact].
  negative: string
}

// A term with no conversions is flagged when it matches a junk word, or when it has already
// cost as much as a lead usually does (or $25, whichever is higher) without producing one.
export function findWastedSearches(terms: SearchTerm[], costPerConversion: number) {
  const spendLimit = Math.max(25, costPerConversion || 0)
  const wasted: WastedSearch[] = []
  for (const t of terms) {
    if (t.conversions >= 0.5) continue
    const match = patterns.find((p) => p.re.test(t.term))
    if (match) {
      wasted.push({ ...t, reason: match.reason, negative: `"${match.word}"` })
    } else if (t.cost >= spendLimit) {
      wasted.push({ ...t, reason: "Spent a lead's worth with no leads", negative: `[${t.term}]` })
    }
  }
  wasted.sort((a, b) => b.cost - a.cost)
  return { wasted, spendLimit, total: wasted.reduce((sum, t) => sum + t.cost, 0) }
}

// One negative per line, without repeats, in Google Ads' paste format.
export function negativeKeywordList(wasted: WastedSearch[]) {
  return [...new Set(wasted.map((w) => w.negative))].join("\n")
}
