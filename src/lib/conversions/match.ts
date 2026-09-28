import type { Attribution } from "@/lib/conversions/types"
import { demoCampaign } from "@/lib/demo-campaign"

// Stand-in for matching a customer to the ads they saw. The real version looks the email, phone
// number, or browser cookie up against ad exposure data from Meta and Google.

// Roughly how often each placement drives a conversion for the demo campaign.
const placementWeights: [Attribution["placementId"], number][] = [
  ["ig-reels", 27],
  ["ig-stories", 19],
  ["fb-feed", 9],
  ["google-search", 17],
  ["google-maps", 14],
  ["yt-shorts", 5],
]
const UNMATCHED_WEIGHT = 12

// The A/B test: "A little cup of SoMa." is pulling ahead.
const adWeights = [46, 33, 21]

function pick<T>(rand: () => number, weighted: [T, number][]) {
  const total = weighted.reduce((sum, [, w]) => sum + w, 0)
  let r = rand() * total
  for (const [value, w] of weighted) {
    r -= w
    if (r <= 0) return value
  }
  return weighted[weighted.length - 1][0]
}

export function attribute(
  rand: () => number,
  contact: { email?: string; phone?: string },
): Attribution | null {
  const placementId = pick<Attribution["placementId"] | null>(rand, [
    ...placementWeights,
    [null, UNMATCHED_WEIGHT],
  ])
  if (!placementId) return null
  const { format } = demoCampaign.placements.find((p) => p.id === placementId)!
  const showsCreative = format === "vertical" || format === "feed"
  return {
    placementId,
    adId: showsCreative
      ? pick(
          rand,
          demoCampaign.ads.map((ad, i): [string, number] => [ad.id, adWeights[i] ?? 10]),
        )
      : undefined,
    // Cookies catch people who never signed in anywhere.
    matchedBy:
      rand() < 0.2
        ? "cookie"
        : contact.email && (!contact.phone || rand() < 0.7)
          ? "email"
          : "phone",
    daysSinceAd: Math.floor(rand() * 6),
  }
}

// A stable random number stream per customer, so a live conversion is matched the same way
// every time it's looked at.
export function contactRandom(key: string) {
  let h = 2166136261
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}
