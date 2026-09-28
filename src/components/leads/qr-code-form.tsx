"use client"

import { useActionState, useState } from "react"
import { Eye } from "lucide-react"

import { cn } from "@/lib/utils"
import type { FormState } from "@/lib/leads/actions"
import type { QrCodeFields } from "@/lib/leads/qr-schema"
import { qrThemes } from "@/lib/leads/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import QrLanding from "@/components/leads/qr-landing"

export const inputClass = "h-12 rounded-xl bg-card px-4 text-base shadow-xs md:text-base"

type QrCodeFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  defaults: QrCodeFields
  submitLabel: string
}

function Hint({ error, children }: { error?: string; children?: React.ReactNode }) {
  if (!error && !children) return null
  return (
    <p className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}>
      {error ?? children}
    </p>
  )
}

// The QR code's fields beside a live phone preview of what people see after scanning.
export default function QrCodeForm({ action, defaults, submitLabel }: QrCodeFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [fields, setFields] = useState(defaults)
  const errors = state?.errors ?? {}
  const set =
    <K extends keyof QrCodeFields>(key: K) =>
    (value: QrCodeFields[K]) =>
      setFields((f) => ({ ...f, [key]: value }))

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="flex flex-col gap-7">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="businessName" className="font-medium">
                Business name
              </label>
              <Input
                id="businessName"
                name="businessName"
                value={fields.businessName}
                onChange={(e) => set("businessName")(e.target.value)}
                aria-invalid={Boolean(errors.businessName)}
                className={inputClass}
              />
              <Hint error={errors.businessName} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="placement" className="font-medium">
                Where will this code go?
              </label>
              <Input
                id="placement"
                name="placement"
                value={fields.placement}
                onChange={(e) => set("placement")(e.target.value)}
                placeholder="Yard sign, 123 Main St"
                aria-invalid={Boolean(errors.placement)}
                className={inputClass}
              />
              <Hint error={errors.placement}>Each lead is tagged with it.</Hint>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="headline" className="font-medium">
              Headline
            </label>
            <Input
              id="headline"
              name="headline"
              value={fields.headline}
              onChange={(e) => set("headline")(e.target.value)}
              maxLength={80}
              aria-invalid={Boolean(errors.headline)}
              className={cn(inputClass, "font-medium")}
            />
            <Hint error={errors.headline}>The big line people see after scanning.</Hint>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="message" className="font-medium">
              Message
            </label>
            <Textarea
              id="message"
              name="message"
              value={fields.message}
              onChange={(e) => set("message")(e.target.value)}
              maxLength={200}
              rows={2}
              className="min-h-20 rounded-xl bg-card px-4 py-3 text-base shadow-xs md:text-base"
            />
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 font-medium">Color</legend>
            <div className="flex flex-wrap gap-2">
              {qrThemes.map((theme) => (
                <label
                  key={theme.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-full border-2 py-1.5 pr-3.5 pl-1.5 text-sm font-medium transition-all",
                    "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    fields.theme === theme.id
                      ? "border-primary"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={theme.id}
                    checked={fields.theme === theme.id}
                    onChange={() => set("theme")(theme.id)}
                    className="sr-only"
                  />
                  <span className="size-6 rounded-full" style={{ background: theme.primary }} />
                  {theme.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-2xl bg-muted/60 p-4 text-sm">
            <p className="font-medium">The form asks for</p>
            <p className="mt-1 text-muted-foreground">
              Name, phone or email (at least one), property address, and an optional note.
            </p>
          </div>
        </div>

        <aside className="flex flex-col items-center gap-3 lg:sticky lg:top-24">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Eye className="size-4" />
            What people see when they scan
          </p>
          <div className="w-full max-w-[340px] rounded-[2.75rem] bg-slate-900 p-3 shadow-2xl shadow-slate-900/25">
            <div className="relative h-[640px] overflow-hidden rounded-[2.1rem] bg-white">
              <div className="absolute top-2 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
              <div className="h-full overflow-y-auto">
                <QrLanding content={fields} />
              </div>
            </div>
          </div>
        </aside>
      </div>
      <div>
        <Button type="submit" size="lg" disabled={pending} className="h-12 rounded-xl px-7 text-base">
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}
