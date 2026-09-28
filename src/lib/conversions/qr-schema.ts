import { z } from "zod"

import { qrThemes, type QrCode } from "@/lib/conversions/types"

// The owner-editable parts of a QR code, shared by the create/edit pages and the campaign step.
export type QrCodeFields = Pick<
  QrCode,
  | "businessName"
  | "placement"
  | "headline"
  | "percentOff"
  | "offerItem"
  | "message"
  | "headerPhoto"
  | "theme"
>

export const qrCodeSchema = z.object({
  businessName: z.string().trim().min(1, "Enter your business name.").max(80),
  placement: z.string().trim().min(1, "Say where this code goes, like “Front counter”.").max(60),
  headline: z.string().trim().min(1, "Write the offer customers see.").max(80),
  percentOff: z.coerce
    .number({ error: "Enter a discount." })
    .int("Use a whole number.")
    .min(5, "Offer at least 5% off.")
    .max(100, "The discount can't be more than 100%."),
  offerItem: z.string().trim().min(1, "Say what the discount is for.").max(40),
  message: z.string().trim().max(160),
  headerPhoto: z.string().trim().min(1),
  theme: z.enum(qrThemes.map((t) => t.id) as [QrCode["theme"], ...QrCode["theme"][]]),
})

// The offer new QR codes start with.
export const DEFAULT_OFFER = {
  headline: "20% off your first coffee",
  percentOff: 20,
  offerItem: "coffee",
  message: "Add your email or phone number and we'll take it off today's order.",
  headerPhoto: "/demo/golden-goat/photo-2.webp",
  theme: "gold",
} as const satisfies Partial<QrCodeFields>

export function qrFieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message
  return errors
}
