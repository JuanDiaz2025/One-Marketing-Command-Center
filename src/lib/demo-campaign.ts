import { suggestCampaign } from "@/lib/campaign-suggestion"
import { mockCreatives } from "@/lib/creatives-mock"
import { demoBusiness, demoPhotos } from "@/lib/demo"
import { placement, type PlacementId } from "@/lib/placements"
import { mockProfileSuggestion } from "@/lib/profile-mock"
import { metaShareFor, platformOptions, type Platform } from "@/lib/setup"

// The campaign the Golden Goat Coffee demo launches in setup, as the dashboard and conversion
// feed see it. Setup answers only live in the browser, so the server rebuilds the same campaign
// from the same demo data.

const profile = mockProfileSuggestion(demoBusiness).profile
const ads = mockCreatives(demoBusiness, profile, demoPhotos.length)
const plan = suggestCampaign(demoBusiness, profile, ads.length)

// The campaign has been running since the start of the month.
export const CAMPAIGN_PERIOD = { start: "2026-09-01", end: "2026-09-26" }

export type CampaignAd = { id: string; angle: string; headline: string; image: string }

export const demoCampaign = {
  business: demoBusiness,
  monthlyBudget: plan.campaign.budget.monthly,
  splitMode: plan.campaign.budget.splitMode,
  platforms: platformOptions
    .filter((p) => plan.campaign.platforms.includes(p.value))
    .map((p) => ({
      ...p,
      share:
        p.value === "meta"
          ? metaShareFor(plan.campaign.platforms, plan.campaign.budget.metaShare)
          : 100 - metaShareFor(plan.campaign.platforms, plan.campaign.budget.metaShare),
    })),
  // Each placement with its share of the whole budget, in percent.
  placements: (Object.entries(plan.channels) as [Platform, typeof plan.channels.meta][]).flatMap(
    ([platform, channels]) => {
      const platformShare =
        platform === "meta" ? plan.campaign.budget.metaShare : 100 - plan.campaign.budget.metaShare
      return channels.map((channel) => ({
        ...placement(channel.id),
        budgetShare: (platformShare * channel.share) / 100,
      }))
    },
  ),
  ads: ads.map((ad): CampaignAd => ({
    id: ad.id,
    angle: ad.angle,
    headline: ad.headline,
    image: ad.image!,
  })),
  conversionSources: plan.campaign.conversionSources,
}

export type CampaignPlacement = (typeof demoCampaign.placements)[number]

export function campaignAd(id: string | undefined) {
  return demoCampaign.ads.find((ad) => ad.id === id)
}

export function campaignPlacement(id: PlacementId) {
  return demoCampaign.placements.find((p) => p.id === id)
}
