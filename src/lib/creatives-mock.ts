import { isDemoBusiness } from "@/lib/demo"
import {
  businessCategories,
  creativeLayouts,
  type BusinessDetails,
  type BusinessProfile,
  type CreativeVariation,
} from "@/lib/setup"

// Stand-in for AI creative generation. The demo business gets finished ads that were made from its
// photos (see demoPhotos in demo.ts for the order `sourcePhotos` refers to). Anything else gets
// variations built from the profile keywords, drawn over the owner's own photos.

const goldenGoatCoffee: Omit<CreativeVariation, "id">[] = [
  {
    angle: "Neighborhood coffee",
    audience: "SoMa office workers",
    headline: "A little cup of SoMa.",
    subline: "Coffee worth finding.",
    cta: "Visit Golden Goat",
    layout: "overlay",
    sourcePhotos: [0],
    image: "/demo/golden-goat/ad-1.webp",
  },
  {
    angle: "Hidden gem",
    audience: "Coffee lovers",
    headline: "The alley is worth finding.",
    subline: "A tiny SoMa coffee shop · 599 3rd St #100",
    cta: "Get directions",
    layout: "overlay",
    sourcePhotos: [1],
    image: "/demo/golden-goat/ad-2.webp",
  },
  {
    angle: "Coffee and pastries",
    audience: "Grab-and-go",
    headline: "Coffee, then croissant.",
    subline: "599 3rd St #100 · Mon–Fri 8–3 · Sat 9–2",
    cta: "Come by this week",
    layout: "overlay",
    sourcePhotos: [0],
    image: "/demo/golden-goat/ad-3.webp",
  },
]

function fromProfile(business: BusinessDetails, profile: BusinessProfile, photoCount: number) {
  const cta = businessCategories.find((c) => c.value === business.category)?.cta ?? "Learn more"
  const angles = [...profile.products, ...profile.brand].slice(0, 6)
  return angles.map((angle, index): Omit<CreativeVariation, "id"> => ({
    angle,
    audience: profile.audience.keywords[index % profile.audience.keywords.length],
    headline: angle,
    subline: business.businessName,
    cta,
    layout: creativeLayouts[index % creativeLayouts.length],
    sourcePhotos: [index % photoCount],
  }))
}

export function mockCreatives(
  business: BusinessDetails,
  profile: BusinessProfile,
  photoCount: number,
): CreativeVariation[] {
  const variations = isDemoBusiness(business)
    ? goldenGoatCoffee
    : fromProfile(business, profile, photoCount)
  return variations.map((variation, index) => ({ ...variation, id: `creative-${index + 1}` }))
}
