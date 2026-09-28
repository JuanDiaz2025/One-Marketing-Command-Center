"use client"

import { useState, useTransition, type CSSProperties } from "react"
import { CircleCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { submitLeadAction, type LeadInput } from "@/lib/leads/actions"
import { qrTheme, type QrCode } from "@/lib/leads/types"

export type QrLandingContent = Pick<QrCode, "businessName" | "headline" | "message" | "theme">

type QrLandingProps = {
  content: QrLandingContent
  // Live pages send the form to the server; previews just show the thank-you screen.
  qrCodeId?: string
}

const emptyLead: Required<LeadInput> = {
  name: "",
  phone: "",
  email: "",
  propertyAddress: "",
  notes: "",
}

const fields = [
  { key: "name", label: "Name", type: "text", autoComplete: "name", required: true },
  { key: "phone", label: "Phone", type: "tel", autoComplete: "tel", placeholder: "(555) 555-0123" },
  { key: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@example.com" },
  {
    key: "propertyAddress",
    label: "Property address",
    type: "text",
    autoComplete: "street-address",
    placeholder: "Street, city",
  },
] as const

// The page people see after scanning a QR code: a headline and a short contact form.
export default function QrLanding({ content, qrCodeId }: QrLandingProps) {
  const theme = qrTheme(content.theme)
  const [lead, setLead] = useState(emptyLead)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  function send() {
    if (!qrCodeId) {
      setSent(true)
      return
    }
    startTransition(async () => {
      const result = await submitLeadAction(qrCodeId, lead)
      if (result.ok) {
        setSent(true)
        window.scrollTo({ top: 0 })
      } else {
        setErrors(result.errors)
      }
    })
  }

  const set = (key: keyof LeadInput) => (value: string) => {
    setLead((l) => ({ ...l, [key]: value }))
    setErrors({})
  }

  // Previews sit inside the owner's form, so only the live page renders a real <form>.
  const Container = qrCodeId ? "form" : "div"
  const themeVars = { "--qr": theme.primary, "--qr-soft": theme.soft } as CSSProperties
  const inputClass = (invalid: boolean) =>
    cn(
      "h-12 w-full rounded-xl border bg-white px-4 text-base outline-none focus-visible:ring-3",
      invalid
        ? "border-red-500 focus-visible:ring-red-500/20"
        : "border-neutral-300 focus-visible:border-[var(--qr)] focus-visible:ring-[var(--qr)]/20",
    )

  return (
    <div style={themeVars} className="flex min-h-full flex-col bg-white text-neutral-900">
      <header className="flex items-center gap-2.5 bg-[var(--qr)] px-5 pt-10 pb-5 text-white">
        <span className="flex size-9 items-center justify-center rounded-full bg-white/20 text-base font-bold">
          {content.businessName.charAt(0).toUpperCase() || "?"}
        </span>
        <span className="text-lg font-semibold">{content.businessName || "Your business"}</span>
      </header>

      {sent ? (
        <div className="flex flex-col items-center gap-4 px-5 py-10 text-center" role="status">
          <CircleCheck className="size-16 text-[var(--qr)]" />
          <h1 className="text-2xl font-bold tracking-tight">Thanks, we got it!</h1>
          <p className="text-neutral-600">
            Someone from {content.businessName || "our team"} will reach out to you soon.
          </p>
          {!qrCodeId && (
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-sm font-medium text-[var(--qr)] underline underline-offset-4"
            >
              Back to the form
            </button>
          )}
        </div>
      ) : (
        <Container
          {...(qrCodeId
            ? {
                onSubmit: (e: React.FormEvent) => {
                  e.preventDefault()
                  send()
                },
                noValidate: true,
              }
            : {})}
          className="flex flex-col gap-5 px-5 py-6"
        >
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance">
              {content.headline || "Your headline"}
            </h1>
            {content.message && <p className="text-neutral-600">{content.message}</p>}
          </div>

          {fields.map((f) => {
            const error = errors[f.key]
            return (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label htmlFor={`lead-${f.key}`} className="font-semibold">
                  {f.label}
                  {"required" in f && <span className="text-[var(--qr)]"> *</span>}
                </label>
                <input
                  id={`lead-${f.key}`}
                  type={f.type}
                  autoComplete={f.autoComplete}
                  placeholder={"placeholder" in f ? f.placeholder : undefined}
                  value={lead[f.key]}
                  onChange={(e) => set(f.key)(e.target.value)}
                  aria-invalid={Boolean(error)}
                  className={inputClass(Boolean(error))}
                />
                {error && (
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )
          })}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="lead-notes" className="font-semibold">
              Anything we should know?
            </label>
            <textarea
              id="lead-notes"
              rows={3}
              value={lead.notes}
              onChange={(e) => set("notes")(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus-visible:border-[var(--qr)] focus-visible:ring-3 focus-visible:ring-[var(--qr)]/20"
            />
          </div>

          {errors.form && (
            <p className="text-sm text-red-600" role="alert">
              {errors.form}
            </p>
          )}

          <button
            type={qrCodeId ? "submit" : "button"}
            onClick={qrCodeId ? undefined : send}
            disabled={pending}
            className="h-14 rounded-xl bg-[var(--qr)] text-lg font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send"}
          </button>
          <p className="text-center text-xs text-neutral-500">
            We only use your details to contact you about your request.
          </p>
        </Container>
      )}
    </div>
  )
}
