import { z } from "zod"

import type { PlacementId } from "@/lib/placements"

export const businessCategories = [
  { value: "restaurant", label: "Restaurant or café", cta: "Order now" },
  { value: "retail", label: "Retail shop", cta: "Shop now" },
  { value: "online-store", label: "Online store", cta: "Shop now" },
  { value: "home-services", label: "Home services", cta: "Get a quote" },
  { value: "health", label: "Health and wellness", cta: "Book now" },
  { value: "beauty", label: "Beauty and personal care", cta: "Book now" },
  { value: "professional", label: "Professional services", cta: "Learn more" },
  { value: "other", label: "Other", cta: "Learn more" },
] as const

export type CategoryValue = (typeof businessCategories)[number]["value"]

const categoryValues = businessCategories.map((c) => c.value) as [CategoryValue, ...CategoryValue[]]

// "https://www.joesbakery.com/menu" → "joesbakery.com". Accepts bare domains, since most owners
// type those. Returns "" if the value isn't a URL.
export function websiteHost(value: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return url.hostname.replace(/^www\./i, "").toLowerCase()
  } catch {
    return ""
  }
}

function isWebsite(value: string) {
  return websiteHost(value).includes(".")
}

export const setupSteps = ["Your business", "Business profile", "Creatives", "Campaign"] as const

export const businessSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, "Enter your business name.")
    .max(80, "Keep the name under 80 characters."),
  category: z.enum(categoryValues, { error: "Choose the option closest to your business." }),
  website: z
    .string()
    .trim()
    .refine((v) => v === "" || isWebsite(v), "Enter a website like joesbakery.com."),
  description: z.string().trim().max(500, "Keep it under 500 characters."),
})

export type BusinessDetails = z.infer<typeof businessSchema>

const zipCode = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "Use a 5-digit ZIP code.")
const keywords = (message: string) => z.array(z.string().trim().min(1)).min(1, message)

export const radiusOptions = [0.5, 1, 3, 5, 10] as const

export const genderOptions = [
  { value: "all", label: "Everyone" },
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
] as const

// Age targeting uses 18–65, where 65 means "65 and over".
export const AGE_MIN = 18
export const AGE_MAX = 65

// What One Marketing Command Center derives from the business in step 2. Kept to keywords so it's quick to review.
export const profileSchema = z.object({
  location: z.object({
    address: z.string().trim().min(1, "Enter your street address."),
    zip: zipCode,
    targetZips: z.array(zipCode).min(1, "Add at least one ZIP code to target."),
    radiusMiles: z.number(),
  }),
  brand: keywords("Add at least one keyword."),
  products: keywords("Add at least one product or service."),
  audience: z
    .object({
      keywords: keywords("Add at least one audience keyword."),
      ageMin: z.number().int().min(AGE_MIN).max(AGE_MAX),
      ageMax: z.number().int().min(AGE_MIN).max(AGE_MAX),
      gender: z.enum(["all", "women", "men"]),
    })
    .refine((a) => a.ageMax >= a.ageMin, {
      path: ["ageMax"],
      message: "The oldest age must be at least the youngest.",
    }),
})

export type BusinessProfile = z.infer<typeof profileSchema>

export function emptyProfile(): BusinessProfile {
  return {
    location: { address: "", zip: "", targetZips: [], radiusMiles: 5 },
    brand: [],
    products: [],
    audience: { keywords: [], ageMin: 25, ageMax: 54, gender: "all" },
  }
}

export type ProfileSuggestion = {
  profile: BusinessProfile
  // Where the suggestion came from, in sentence case, e.g. "joesbakery.com", "online reviews".
  // Empty if nothing was found.
  sources: string[]
}

// Setup answers are kept in memory, so they carry across steps but a page refresh starts over.
// (Handy for demos: the step 2 loading screen plays every time.)
export const MAX_PHOTOS = 10
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024
// The platforms need at least two ads to A/B test.
export const MIN_CREATIVE_PICKS = 2

export type UploadedPhoto = {
  id: string
  name: string
  // An object URL for the file, valid until the page is refreshed.
  url: string
}

export const creativeLayouts = ["overlay", "band", "sticker"] as const

// One 9:16 ad variation, aimed at a single angle from the business profile.
export type CreativeVariation = {
  id: string
  // The idea the ad leans on, e.g. "Hidden gem".
  angle: string
  // Who the ad is aimed at, from the profile's audience keywords.
  audience: string
  headline: string
  subline: string
  cta: string
  layout: (typeof creativeLayouts)[number]
  // Which of the owner's uploaded photos the ad was made from, by position.
  sourcePhotos: number[]
  // A finished creative image. Without one, the card is drawn from the first source photo.
  image?: string
}

export const platformOptions = [
  { value: "meta", label: "Meta", detail: "Facebook and Instagram" },
  { value: "google", label: "Google", detail: "Search, Maps, and YouTube" },
] as const

export type Platform = (typeof platformOptions)[number]["value"]

export const conversionSourceOptions = [
  {
    value: "qr",
    label: "QR codes",
    tag: "In-store",
    detail: "Customers scan a code at your counter. Each scan counts as an in-store visit.",
  },
  {
    value: "website",
    label: "Website",
    tag: "Online",
    detail: "Add the One Marketing Command Center tag to count orders, bookings, and sign-ups on your site.",
  },
  {
    value: "pos",
    label: "Point of sale",
    tag: "In-store",
    detail: "Connect Square, Toast, or Clover to count sales at the register.",
  },
  {
    value: "customer-list",
    label: "Customer list",
    tag: "Upload",
    detail: "Upload emails and phone numbers of past customers as a CSV.",
  },
] as const

export type ConversionSource = (typeof conversionSourceOptions)[number]["value"]

const platformValues = platformOptions.map((p) => p.value) as [Platform, ...Platform[]]
const sourceValues = conversionSourceOptions.map((s) => s.value) as [
  ConversionSource,
  ...ConversionSource[],
]

export const campaignSchema = z.object({
  platforms: z.array(z.enum(platformValues)).min(1, "Pick at least one platform."),
  budget: z.object({
    monthly: z
      .number({ error: "Enter a monthly budget." })
      .int("Use whole dollars.")
      .min(100, "Set at least $100 a month.")
      .max(100_000, "Keep it under $100,000 a month."),
    // "auto" lets One Marketing Command Center split the budget between platforms and keep adjusting it.
    splitMode: z.enum(["auto", "custom"]),
    // Meta's share when both platforms are on; Google gets the rest.
    metaShare: z.number().int().min(0).max(100),
  }),
  conversionSources: z
    .array(z.enum(sourceValues))
    .min(1, "Add at least one way to count conversions."),
})

export type CampaignSettings = z.infer<typeof campaignSchema>

// Meta's share of the budget, which is all or nothing when only one platform is on.
export function metaShareFor(platforms: Platform[], metaShare: number) {
  if (!platforms.includes("google")) return 100
  if (!platforms.includes("meta")) return 0
  return metaShare
}

// How an ad looks in a placement, for drawing a small preview of it.
export type ChannelFormat = "vertical" | "feed" | "search" | "map"

// A placement One Marketing Command Center picks within a platform, e.g. Instagram Reels.
export type Channel = {
  id: PlacementId
  name: string
  format: ChannelFormat
  formatLabel: string
  // This placement's share of its platform's budget, in percent.
  share: number
  // Why it's a good fit for the business, in a few words.
  detail: string
}

export type CampaignSuggestion = {
  campaign: CampaignSettings
  // Why the automatic split gives each platform its share, in plain words.
  splitReasons: Record<Platform, string>
  // The placements the automatic plan uses on each platform.
  channels: Record<Platform, Channel[]>
  // What the plan was based on, shown back to the owner.
  basedOn: { kind: "location" | "audience" | "product" | "ads"; label: string }[]
}

export type SetupDraft = {
  business?: BusinessDetails
  profile?: BusinessProfile
  // The suggestion One Marketing Command Center made, kept so the owner can reset their edits.
  suggestion?: ProfileSuggestion
  // The business the suggestion was made for, so it's redone if step 1 changes.
  suggestionFor?: string
  photos?: UploadedPhoto[]
  creatives?: CreativeVariation[]
  // The photos and profile the creatives were made from, so they're redone if either changes.
  creativesFor?: string
  selectedCreatives?: string[]
  campaign?: CampaignSettings
}

export function businessKey(business: BusinessDetails) {
  return JSON.stringify(business)
}

export function creativesKey(photos: UploadedPhoto[], profile: BusinessProfile) {
  return JSON.stringify({ photos: photos.map((p) => p.id), profile })
}

let draft: SetupDraft = {}

export function loadDraft(): SetupDraft {
  return draft
}

export function saveDraft(update: Partial<SetupDraft>) {
  draft = { ...draft, ...update }
}
