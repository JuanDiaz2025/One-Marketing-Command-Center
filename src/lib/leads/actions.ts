"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireSession } from "@/lib/auth/session"
import { fieldErrors, qrCodeSchema } from "@/lib/leads/qr-schema"
import { addLead, createQrCode, getQrCode, updateQrCode } from "@/lib/leads/store"

export type FormState = { errors?: Record<string, string> } | undefined

// Server actions can be called directly, so each one used by the team checks the session itself.

export async function createQrCodeAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireSession("/leads/qr/new")
  const parsed = qrCodeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  const code = await createQrCode(parsed.data)
  revalidatePath("/leads")
  redirect(`/leads/qr/${code.id}`)
}

export async function updateQrCodeAction(
  id: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession(`/leads/qr/${id}/edit`)
  const parsed = qrCodeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  await updateQrCode(id, parsed.data)
  revalidatePath("/leads")
  redirect(`/leads/qr/${id}`)
}

export async function setQrCodeActiveAction(id: string, active: boolean) {
  await requireSession(`/leads/qr/${id}`)
  await updateQrCode(id, { active })
  revalidatePath("/leads")
  revalidatePath(`/leads/qr/${id}`)
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || undefined)

const leadSchema = z
  .object({
    name: z.string().trim().min(1, "Add your name.").max(100),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Check your phone number.")
      .transform((v) => v || undefined),
    // Trimmed before checking: phone keyboards often add a space after the address.
    email: z
      .string()
      .trim()
      .pipe(z.union([z.literal(""), z.email("Check your email address.")]))
      .transform((v) => v.toLowerCase() || undefined),
    propertyAddress: optional(200),
    notes: optional(1000),
  })
  .refine((d) => d.phone || d.email, {
    path: ["phone"],
    message: "Add a phone number or email so we can reach you.",
  })

export type LeadInput = z.input<typeof leadSchema>
export type LeadResult = { ok: true } | { ok: false; errors: Record<string, string> }

// The public form behind a QR code. Anyone who scans can send it, so no session check.
export async function submitLeadAction(qrCodeId: string, input: LeadInput): Promise<LeadResult> {
  const code = await getQrCode(qrCodeId)
  if (!code || !code.active) {
    return { ok: false, errors: { form: "This form is no longer taking responses." } }
  }
  const parsed = leadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }
  await addLead({ qrCodeId, ...parsed.data })
  revalidatePath("/leads")
  revalidatePath("/dashboard")
  return { ok: true }
}
