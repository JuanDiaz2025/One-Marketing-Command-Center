"use client"

import { useActionState, useState } from "react"
import { Check, Eye, Lock, Mail, Receipt, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import type { FormState } from "@/lib/conversions/actions"
import { sampleOrder } from "@/lib/conversions/menu"
import type { QrCodeFields } from "@/lib/conversions/qr-schema"
import { qrThemes } from "@/lib/conversions/types"
import type { UploadedPhoto } from "@/lib/setup"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import QrLanding from "@/components/conversions/qr-landing"
import { inputClass, primaryButtonClass } from "@/components/setup/styles"

type QrCodeFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  defaults: QrCodeFields
  // The business's photos, to pick a header from.
  photos: UploadedPhoto[]
  submitLabel: string
  // Shown above the form when the fields were filled in automatically.
  suggestedFor?: string
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="font-medium">
      {children}
    </label>
  )
}

function Hint({ error, children }: { error?: string; children?: React.ReactNode }) {
  if (!error && !children) return null
  return (
    <p className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}>
      {error ?? children}
    </p>
  )
}

type QrCodeFieldsetProps = {
  fields: QrCodeFields
  onChange: (fields: QrCodeFields) => void
  errors: Record<string, string>
  // The business's photos, to pick a header from.
  photos: UploadedPhoto[]
  // Shown above the fields when they were filled in automatically.
  suggestedFor?: string
  // A narrower layout with a smaller preview, for use inside another form.
  compact?: boolean
}

// The QR code's fields beside a live phone preview of what customers see. Inputs are named so
// they also submit with a plain form.
export function QrCodeFieldset({
  fields,
  onChange,
  errors,
  photos,
  suggestedFor,
  compact,
}: QrCodeFieldsetProps) {
  const set =
    <K extends keyof QrCodeFields>(key: K) =>
    (value: QrCodeFields[K]) =>
      onChange({ ...fields, [key]: value })

  return (
    <div
      className={cn(
        "grid items-start gap-10",
        compact
          ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,280px)] xl:gap-8"
          : "lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]",
      )}
    >
      <div className="flex flex-col gap-7">
        {suggestedFor && (
          <p className="flex items-start gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            Filled in for {suggestedFor} from your business profile and photos. Change anything.
          </p>
        )}

        <div className={cn("grid gap-6", !compact && "sm:grid-cols-2")}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="businessName">Business name</Label>
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
            <Label htmlFor="placement">Where will this code go?</Label>
            <Input
              id="placement"
              name="placement"
              value={fields.placement}
              onChange={(e) => set("placement")(e.target.value)}
              placeholder="Front counter"
              aria-invalid={Boolean(errors.placement)}
              className={inputClass}
            />
            <Hint error={errors.placement}>Conversions are tagged with it.</Hint>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="headline">Offer</Label>
          <Input
            id="headline"
            name="headline"
            value={fields.headline}
            onChange={(e) => set("headline")(e.target.value)}
            maxLength={80}
            aria-invalid={Boolean(errors.headline)}
            className={cn(inputClass, "font-medium")}
          />
          <Hint error={errors.headline}>The big line customers see after scanning.</Hint>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-medium">Discount</span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-28">
              <Input
                name="percentOff"
                type="number"
                min={5}
                max={100}
                value={Number.isNaN(fields.percentOff) ? "" : fields.percentOff}
                onChange={(e) =>
                  set("percentOff")(e.target.value === "" ? NaN : Number(e.target.value))
                }
                aria-label="Percent off"
                aria-invalid={Boolean(errors.percentOff)}
                className={cn(inputClass, "pr-8 tabular-nums")}
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
            <span className="text-muted-foreground">off your first</span>
            <Input
              name="offerItem"
              value={fields.offerItem}
              onChange={(e) => set("offerItem")(e.target.value)}
              aria-label="What the discount is for"
              aria-invalid={Boolean(errors.offerItem)}
              className={cn(inputClass, "w-40")}
            />
          </div>
          <Hint error={errors.percentOff ?? errors.offerItem}>
            Taken off the first item in the order, on a customer&apos;s first visit only.
          </Hint>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            name="message"
            value={fields.message}
            onChange={(e) => set("message")(e.target.value)}
            maxLength={160}
            rows={2}
            className="min-h-20 rounded-xl bg-card px-4 py-3 text-base shadow-xs md:text-base"
          />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-medium">Header photo</legend>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {photos.map((photo) => (
              <label
                key={photo.id}
                className={cn(
                  "relative aspect-square cursor-pointer overflow-hidden rounded-xl ring-2 transition-all",
                  "has-focus-visible:ring-ring/50",
                  fields.headerPhoto === photo.url
                    ? "ring-primary"
                    : "ring-transparent hover:ring-primary/40",
                )}
              >
                <input
                  type="radio"
                  name="headerPhoto"
                  value={photo.url}
                  checked={fields.headerPhoto === photo.url}
                  onChange={() => set("headerPhoto")(photo.url)}
                  className="sr-only"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.name} className="size-full object-cover" />
                {fields.headerPhoto === photo.url && (
                  <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>

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

        <div className="flex flex-col gap-2">
          <span className="font-medium">Collected automatically</span>
          <ul className="flex flex-col gap-2">
            {[
              {
                icon: Mail,
                title: "Email or phone number",
                detail:
                  "Required to claim the offer. Used to match the customer to the ads they saw.",
              },
              {
                icon: Receipt,
                title: "What they bought",
                detail:
                  "Pulled from your register as soon as they scan, so every conversion has its order.",
              },
            ].map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex items-start gap-3 rounded-2xl bg-muted/60 p-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium">{title}</span>
                  <span className="text-sm text-muted-foreground">{detail}</span>
                </span>
                <Lock
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-label="Always on"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <aside className={cn("flex flex-col items-center gap-3", !compact && "lg:sticky lg:top-24")}>
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Eye className="size-4" />
          What customers see when they scan
        </p>
        {/* Phone frame */}
        <div
          className="w-full max-w-[340px] rounded-[2.75rem] bg-slate-900 p-3 shadow-2xl shadow-slate-900/25"
          style={compact ? { zoom: 0.8 } : undefined}
        >
          <div className="relative h-[640px] overflow-hidden rounded-[2.1rem] bg-white">
            <div className="absolute top-2 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
            <div className="h-full overflow-y-auto">
              <QrLanding content={fields} items={sampleOrder} />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Sample order. The real one comes from your register.
        </p>
      </aside>
    </div>
  )
}

export default function QrCodeForm({
  action,
  defaults,
  photos,
  submitLabel,
  suggestedFor,
}: QrCodeFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [fields, setFields] = useState(defaults)

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      <QrCodeFieldset
        fields={fields}
        onChange={setFields}
        errors={state?.errors ?? {}}
        photos={photos}
        suggestedFor={suggestedFor}
      />
      <div>
        <Button type="submit" size="lg" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}
