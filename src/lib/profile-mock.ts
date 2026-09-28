import { isDemoBusiness } from "@/lib/demo"
import { emptyProfile, type BusinessDetails, type ProfileSuggestion } from "@/lib/setup"

// Stand-in for the AI step that will read the business's website and listings.
// Returns hand-written research for the demo business, and a blank starter for anything else.

const goldenGoatCoffee: ProfileSuggestion = {
  sources: ["goldengoatcoffee.com", "online reviews"],
  profile: {
    location: {
      address: "599 3rd St #100, San Francisco, CA",
      zip: "94107",
      // SoMa and South Park, South Beach, SoMa west of 4th St, and Mission Bay.
      targetZips: ["94107", "94105", "94103", "94158"],
      radiusMiles: 1,
    },
    brand: ["Hidden gem", "Coffee playground", "Rotating roasters", "Playful", "Loyal locals"],
    products: ["Golden Goat Latte", "Goat milk", "Seasonal lattes", "Pour-over", "Fresh pastries"],
    audience: {
      keywords: ["SoMa office workers", "Caltrain commuters", "Coffee lovers", "Grab-and-go"],
      ageMin: 22,
      ageMax: 45,
      gender: "all",
    },
  },
}

export function mockProfileSuggestion(business: BusinessDetails): ProfileSuggestion {
  return isDemoBusiness(business)
    ? structuredClone(goldenGoatCoffee)
    : { sources: [], profile: emptyProfile() }
}
