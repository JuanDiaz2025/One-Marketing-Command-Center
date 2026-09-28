import { websiteHost, type BusinessDetails, type UploadedPhoto } from "@/lib/setup"

// Everything the Golden Goat Coffee demo is scripted around. Assets are in public/demo/golden-goat/.

// Step 1 starts filled in with the demo business so the demo can go straight through.
export const demoBusiness: BusinessDetails = {
  businessName: "Golden Goat Coffee",
  category: "restaurant",
  website: "goldengoatcoffee.com",
  description:
    "Tiny specialty coffee shop tucked in a SoMa alley, with rotating roasters and a signature goat milk latte.",
}

export function isDemoBusiness(business: BusinessDetails) {
  return websiteHost(business.website) === "goldengoatcoffee.com"
}

// The creatives step starts with the shop's real photos. The demo ads are made from the first
// two (see creatives-mock.ts), so keep this order.
export const demoPhotos: UploadedPhoto[] = [
  "Latte and financier on the counter",
  "Latte at the front window",
  "The team out front",
  "The coffee bar",
  "Seating and art",
  "Storefront",
].map((name, index) => ({
  id: `demo-photo-${index + 1}`,
  name,
  url: `/demo/golden-goat/photo-${index + 1}.webp`,
}))
