import { isDemoBusiness } from "@/lib/demo"
import { placement } from "@/lib/placements"
import type {
  BusinessDetails,
  BusinessProfile,
  CampaignSuggestion,
  Channel,
  Platform,
} from "@/lib/setup"

// Stand-in for One Marketing Command Center's campaign recommendation: a starting budget, an automatic split between
// platforms, the placements to use on each, and the conversion source that fits how the business
// sells.

const inStoreCategories = new Set(["restaurant", "retail", "beauty", "health"])

function basedOn(profile: BusinessProfile, adCount: number): CampaignSuggestion["basedOn"] {
  const { location, audience, products } = profile
  return [
    ...(location.zip
      ? [
          {
            kind: "location" as const,
            label: `${location.zip} · ${location.radiusMiles} mi radius`,
          },
        ]
      : []),
    ...audience.keywords.slice(0, 2).map((label) => ({ kind: "audience" as const, label })),
    ...products.slice(0, 1).map((label) => ({ kind: "product" as const, label })),
    { kind: "ads", label: `${adCount} vertical ${adCount === 1 ? "ad" : "ads"}` },
  ]
}

const demoChannels: Record<Platform, Channel[]> = {
  meta: [
    { ...placement("ig-reels"), share: 40, detail: "Your 9:16 ads play full screen as locals scroll." },
    {
      ...placement("ig-stories"),
      share: 35,
      detail: "Morning check-ins, right before the coffee run.",
    },
    { ...placement("fb-feed"), share: 25, detail: "Reaches office workers on their lunch break." },
  ],
  google: [
    {
      ...placement("google-search"),
      share: 50,
      detail: "Shows up for “coffee near me” and “latte SoMa”.",
    },
    {
      ...placement("google-maps"),
      share: 30,
      detail: "Puts your pin first for people nearby looking for coffee.",
    },
    {
      ...placement("yt-shorts"),
      share: 20,
      detail: "Reuses your 9:16 ads for commuters watching Shorts.",
    },
  ],
}

const defaultChannels: Record<Platform, Channel[]> = {
  meta: [
    { ...demoChannels.meta[0], detail: "Your 9:16 ads play full screen as people scroll." },
    { ...demoChannels.meta[1], detail: "Full-screen ads between friends' stories." },
    { ...demoChannels.meta[2], detail: "Reaches people nearby as they scroll their feed." },
  ],
  google: [
    { ...demoChannels.google[0], detail: "Shows up when people nearby search for what you sell." },
    { ...demoChannels.google[1], detail: "Puts your pin first for people looking nearby." },
    { ...demoChannels.google[2], detail: "Reuses your 9:16 ads on YouTube Shorts." },
  ],
}

export function suggestCampaign(
  business: BusinessDetails,
  profile: BusinessProfile,
  adCount: number,
): CampaignSuggestion {
  if (isDemoBusiness(business)) {
    return {
      campaign: {
        platforms: ["meta", "google"],
        budget: { monthly: 600, splitMode: "auto", metaShare: 60 },
        conversionSources: ["qr"],
      },
      splitReasons: {
        meta: "Your photo ads reach SoMa office workers and Caltrain commuters as they scroll.",
        google: "You show up when people nearby search for coffee or look you up on Maps.",
      },
      channels: demoChannels,
      basedOn: basedOn(profile, adCount),
    }
  }

  const audience = profile.audience.keywords.slice(0, 2).join(" and ") || "your customers"
  return {
    campaign: {
      platforms: ["meta", "google"],
      budget: { monthly: 500, splitMode: "auto", metaShare: 50 },
      conversionSources: [inStoreCategories.has(business.category) ? "qr" : "website"],
    },
    splitReasons: {
      meta: `Your ads reach ${audience} as they scroll Facebook and Instagram.`,
      google: "You show up when people nearby search for what you sell.",
    },
    channels: defaultChannels,
    basedOn: basedOn(profile, adCount),
  }
}
