import type { PlacementId } from "@/lib/placements"
import type { Platform } from "@/lib/setup"

// Color themes for the page customers see after scanning.
export const qrThemes = [
  { id: "gold", label: "Golden", primary: "#b7791f", soft: "#fdf3dc" },
  { id: "espresso", label: "Espresso", primary: "#6b4226", soft: "#f4ebe4" },
  { id: "sage", label: "Sage", primary: "#4d7c57", soft: "#e9f2ea" },
  { id: "berry", label: "Berry", primary: "#9d2f6b", soft: "#f8e6ef" },
] as const

export type QrThemeId = (typeof qrThemes)[number]["id"]

export function qrTheme(id: QrThemeId) {
  return qrThemes.find((t) => t.id === id) ?? qrThemes[0]
}

// A QR code in the store. Scanning it opens an offer page; claiming the offer with an email or
// phone number records a conversion.
export type QrCode = {
  id: string
  businessName: string
  // Where the code is placed, e.g. "Front counter". Conversions are tagged with it.
  placement: string
  headline: string
  percentOff: number
  // What the discount applies to, e.g. "coffee".
  offerItem: string
  message: string
  headerPhoto: string
  theme: QrThemeId
  active: boolean
  createdAt: string // ISO datetime
}

export type OrderItem = { name: string; price: number } // price in USD

// Which ad a customer was matched to, and how.
export type Attribution = {
  placementId: PlacementId
  // The campaign ad they saw, for placements that show the owner's creatives.
  adId?: string
  matchedBy: "email" | "phone" | "cookie"
  // How long before converting they last saw the ad.
  daysSinceAd: number
}

export type Conversion = {
  id: string
  qrCodeId: string
  createdAt: string // ISO datetime
  email?: string
  phone?: string
  items: OrderItem[]
  subtotal: number
  discount: number
  total: number
  firstVisit: boolean
  // null when the customer couldn't be matched to an ad (e.g. a walk-in).
  attribution: Attribution | null
  // Platforms the conversion was sent back to, to improve their targeting.
  sentTo: Platform[]
}
