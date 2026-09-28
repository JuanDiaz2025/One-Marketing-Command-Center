"use client"

import Link from "next/link"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowLeft,
  Check,
  CreditCard,
  FileSpreadsheet,
  Globe,
  Megaphone,
  QrCode,
  Rocket,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { QrCodeFieldset } from "@/components/conversions/qr-code-form"
import AutoPlan from "@/components/setup/auto-plan"
import FeedbackLoop from "@/components/setup/feedback-loop"
import {
  Section,
  currency,
  numberFieldProps,
  type SectionStatus,
} from "@/components/setup/form-parts"
import { inputClass, primaryButtonClass } from "@/components/setup/styles"
import {
  campaignSchema,
  conversionSourceOptions,
  metaShareFor,
  platformOptions,
  type CampaignSettings,
  type CampaignSuggestion,
  type ConversionSource,
  type Platform,
  type UploadedPhoto,
} from "@/lib/setup"
import type { QrCodeFields } from "@/lib/conversions/qr-schema"

const platformVisuals: Record<Platform, { icon: LucideIcon; chip: string; placements: string[] }> =
  {
    meta: {
      icon: Smartphone,
      chip: "bg-blue-100 text-blue-600",
      placements: ["Feeds", "Stories", "Reels"],
    },
    google: {
      icon: Search,
      chip: "bg-amber-100 text-amber-600",
      placements: ["Search", "Maps", "YouTube Shorts"],
    },
  }

const sourceIcons: Record<ConversionSource, LucideIcon> = {
  qr: QrCode,
  website: Globe,
  pos: CreditCard,
  "customer-list": FileSpreadsheet,
}

// Adds or removes a value, for checkbox groups.
function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full transition-all",
        checked ? "bg-primary text-primary-foreground" : "text-transparent ring-2 ring-border",
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  )
}

type CampaignFormProps = {
  businessName: string
  suggestion: CampaignSuggestion
  // The owner's picked ads, for previewing them in each placement.
  adImages: string[]
  initial?: CampaignSettings
  // The QR code set up alongside the campaign when QR codes are a conversion source.
  qr: {
    fields: QrCodeFields
    onChange: (fields: QrCodeFields) => void
    errors: Record<string, string>
    photos: UploadedPhoto[]
  }
  onLaunch: (campaign: CampaignSettings) => void
}

export default function CampaignForm({
  businessName,
  suggestion,
  adImages,
  initial,
  qr,
  onLaunch,
}: CampaignFormProps) {
  // Defaults are the suggestion, so "dirty" means "changed from what One Marketing Command Center suggested".
  const form = useForm<CampaignSettings>({
    resolver: zodResolver(campaignSchema),
    defaultValues: suggestion.campaign,
    values: initial,
    resetOptions: { keepDefaultValues: true },
  })
  const { dirtyFields } = form.formState

  const platforms = useWatch({ control: form.control, name: "platforms" })
  const conversionSources = useWatch({ control: form.control, name: "conversionSources" })
  const budget = useWatch({ control: form.control, name: "budget" })
  const monthly = Number.isNaN(budget.monthly) ? 0 : budget.monthly
  const metaShare = metaShareFor(platforms, budget.metaShare)
  const metaAmount = Math.round((monthly * metaShare) / 100)
  const bothPlatforms = platforms.length === 2

  function status(section: keyof CampaignSettings): SectionStatus {
    return dirtyFields[section] ? "edited" : "suggested"
  }

  return (
    <form onSubmit={form.handleSubmit(onLaunch)} className="flex flex-col gap-6" noValidate>
      <Section
        icon={Megaphone}
        iconClassName="bg-sky-100 text-sky-600"
        title="Platforms"
        description="Where your ads will run."
        status={status("platforms")}
      >
        <Controller
          name="platforms"
          control={form.control}
          render={({ field, fieldState }) => (
            <FieldSet data-invalid={fieldState.invalid} className="gap-3">
              <FieldLegend className="sr-only">Platforms</FieldLegend>
              <div className="grid gap-3 sm:grid-cols-2">
                {platformOptions.map((platform) => {
                  const visual = platformVisuals[platform.value]
                  const Icon = visual.icon
                  const checked = field.value.includes(platform.value)
                  return (
                    <label
                      key={platform.value}
                      className={cn(
                        "flex cursor-pointer flex-col gap-4 rounded-2xl border-2 p-4 transition-all",
                        "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        checked
                          ? "border-primary bg-secondary/50 shadow-md"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => field.onChange(toggle(field.value, platform.value))}
                        onBlur={field.onBlur}
                        className="sr-only"
                      />
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-xl",
                            visual.chip,
                          )}
                        >
                          <Icon className="size-5" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="font-semibold">{platform.label}</span>
                          <span className="text-sm text-muted-foreground">{platform.detail}</span>
                        </div>
                        <CheckMark checked={checked} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {visual.placements.map((placement) => (
                          <span
                            key={placement}
                            className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {placement}
                          </span>
                        ))}
                      </div>
                    </label>
                  )
                })}
              </div>
              <FieldError errors={[fieldState.error]} />
            </FieldSet>
          )}
        />
      </Section>

      <Section
        icon={Wallet}
        iconClassName="bg-violet-100 text-violet-600"
        title="Budget"
        description="What you'll spend each month. You can change it anytime."
        status={status("budget")}
      >
        <Controller
          name="budget.monthly"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="monthly">Monthly budget</FieldLabel>
              <div className="relative max-w-48">
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  {...numberFieldProps(field)}
                  onBlur={field.onBlur}
                  id="monthly"
                  type="number"
                  inputMode="numeric"
                  min={100}
                  step={50}
                  aria-invalid={fieldState.invalid}
                  className={cn(inputClass, "pl-8 tabular-nums")}
                />
              </div>
              <FieldDescription>About {currency.format(monthly / 30)} a day.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        {bothPlatforms ? (
          <Controller
            name="budget.splitMode"
            control={form.control}
            render={({ field }) => (
              <FieldSet className="gap-3">
                <FieldLegend variant="label">How to split it</FieldLegend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        value: "auto",
                        icon: Sparkles,
                        label: "Auto",
                        badge: "Recommended",
                        detail:
                          "One Marketing Command Center uses what it knows about your business to split the budget and pick where your ads show.",
                      },
                      {
                        value: "custom",
                        icon: SlidersHorizontal,
                        label: "Custom",
                        detail: "Set how much goes to each platform yourself.",
                      },
                    ] as const
                  ).map((option) => {
                    const Icon = option.icon
                    const checked = field.value === option.value
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-all",
                          "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                          checked
                            ? "border-primary bg-secondary/50"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <input
                          type="radio"
                          name={field.name}
                          checked={checked}
                          onChange={() => {
                            field.onChange(option.value)
                            // Going back to auto restores One Marketing Command Center's split.
                            if (option.value === "auto") {
                              form.setValue(
                                "budget.metaShare",
                                suggestion.campaign.budget.metaShare,
                                { shouldDirty: true },
                              )
                            }
                          }}
                          className="sr-only"
                        />
                        <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2 font-semibold">
                            {option.label}
                            {"badge" in option && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                {option.badge}
                              </span>
                            )}
                          </span>
                          <span className="text-sm text-muted-foreground">{option.detail}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </FieldSet>
            )}
          />
        ) : null}

        {(budget.splitMode === "auto" || platforms.length === 1) && platforms.length > 0 && (
          <AutoPlan
            businessName={businessName}
            suggestion={suggestion}
            platforms={platforms}
            monthly={monthly}
            metaShare={metaShare}
            adImages={adImages}
          />
        )}

        {bothPlatforms && budget.splitMode === "custom" && (
          <Controller
            name="budget.metaShare"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="metaShare" className="sr-only">
                  Meta&apos;s share of the budget
                </FieldLabel>
                <input
                  id="metaShare"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  aria-valuetext={`Meta ${field.value}%, Google ${100 - field.value}%`}
                  // Meta's share in blue-violet, Google's in amber-green, split at the thumb.
                  style={{
                    background: `linear-gradient(to right, #3b82f6, #8b5cf6 ${field.value}%, #fbbf24 ${field.value}%, #34d399)`,
                  }}
                  className={cn(
                    "my-2 h-3 w-full cursor-pointer appearance-none rounded-full outline-none",
                    "[&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md",
                    "[&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-md",
                    "focus-visible:ring-3 focus-visible:ring-ring/50",
                  )}
                />
                <div className="flex justify-between gap-4 text-sm">
                  <p>
                    <span className="font-medium">Meta {field.value}%</span>
                    <span className="text-muted-foreground"> · {currency.format(metaAmount)}</span>
                  </p>
                  <p className="text-right">
                    <span className="font-medium">Google {100 - field.value}%</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {currency.format(monthly - metaAmount)}
                    </span>
                  </p>
                </div>
              </Field>
            )}
          />
        )}
      </Section>

      <Section
        icon={Target}
        iconClassName="bg-emerald-100 text-emerald-600"
        title="Conversions"
        description="How One Marketing Command Center counts the customers your ads bring in."
        status={status("conversionSources")}
      >
        <FeedbackLoop
          platforms={platformOptions.filter((p) => platforms.includes(p.value)).map((p) => p.label)}
          sources={conversionSourceOptions
            .filter((o) => conversionSources.includes(o.value))
            .map((o) => o.label)}
        />

        <Controller
          name="conversionSources"
          control={form.control}
          render={({ field, fieldState }) => (
            <FieldSet data-invalid={fieldState.invalid} className="gap-3">
              <FieldLegend variant="label">Add a conversion source</FieldLegend>
              <div className="grid gap-3 sm:grid-cols-2">
                {conversionSourceOptions.map((source) => {
                  const Icon = sourceIcons[source.value]
                  const checked = field.value.includes(source.value)
                  const recommended = suggestion.campaign.conversionSources.includes(source.value)
                  return (
                    <label
                      key={source.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-all",
                        "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        checked
                          ? "border-primary bg-secondary/50 shadow-md"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => field.onChange(toggle(field.value, source.value))}
                        onBlur={field.onBlur}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          source.value === "qr"
                            ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{source.label}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {source.tag}
                          </span>
                          {recommended && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              <Sparkles className="size-3" />
                              Recommended
                            </span>
                          )}
                        </span>
                        <span className="text-sm text-muted-foreground">{source.detail}</span>
                      </span>
                      <CheckMark checked={checked} />
                    </label>
                  )
                })}
              </div>
              <FieldError errors={[fieldState.error]} />
            </FieldSet>
          )}
        />

        {conversionSources.includes("qr") && (
          <div
            id="qr-setup"
            className="flex scroll-mt-24 flex-col gap-5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-5 sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                <QrCode className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">Set up your QR code</h3>
                <p className="text-sm text-muted-foreground">
                  It&apos;s created when you launch, ready to print and put by the register.
                </p>
              </div>
            </div>
            <QrCodeFieldset
              fields={qr.fields}
              onChange={qr.onChange}
              errors={qr.errors}
              photos={qr.photos}
              suggestedFor={businessName}
              compact
            />
          </div>
        )}
      </Section>

      <div className="flex flex-wrap items-center gap-3 pt-4">
        <Link
          href="/setup/creatives"
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 rounded-xl px-4")}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <Button type="submit" size="lg" className={cn(primaryButtonClass, "ml-auto")}>
          <Rocket className="size-4" />
          Launch campaign
        </Button>
      </div>
    </form>
  )
}
