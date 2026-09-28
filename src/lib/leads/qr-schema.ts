import { z } from "zod"

import { qrThemes, type QrCode, type QrThemeId } from "@/lib/leads/types"

// The owner-editable parts of a QR code, shared by the create and edit pages.
export type QrCodeFields = Pick<
  QrCode,
  "businessName" | "placement" | "headline" | "message" | "theme"
>

export const qrCodeSchema = z.object({
  businessName: z.string().trim().min(1, "Enter your business name.").max(80),
  placement: z
    .string()
    .trim()
    .min(1, "Say where this code goes, like “Yard sign, 123 Main St”.")
    .max(60),
  headline: z.string().trim().min(1, "Write the line people see after scanning.").max(80),
  message: z.string().trim().max(200),
  theme: z.enum(qrThemes.map((t) => t.id) as [QrThemeId, ...QrThemeId[]]),
})

// What a new QR code starts with. Everything can be changed.
export const NEW_QR_CODE: QrCodeFields = {
  businessName: "",
  placement: "",
  headline: "Get a cash offer on your house",
  message: "Tell us how to reach you and we'll get back to you with an offer.",
  theme: "blue",
}

export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message
  return errors
}
