"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, ArrowRight, Coffee, MapPin, RotateCcw, Sparkles, Users } from "lucide-react"

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
import ChoiceGroup from "@/components/setup/choice-group"
import { Section, numberFieldProps, type SectionStatus } from "@/components/setup/form-parts"
import KeywordInput from "@/components/setup/keyword-input"
import { inputClass, primaryButtonClass } from "@/components/setup/styles"
import {
  AGE_MAX,
  AGE_MIN,
  genderOptions,
  profileSchema,
  radiusOptions,
  saveDraft,
  type BusinessProfile,
  type ProfileSuggestion,
} from "@/lib/setup"

const radiusChoices = radiusOptions.map((miles) => ({ value: miles, label: `${miles} mi` }))

const parseZip = (text: string) => (/^\d{5}$/.test(text) ? text : null)

type ProfileFormProps = {
  suggestion: ProfileSuggestion
  // Saved edits to start from, if the owner has been here before.
  initial?: BusinessProfile
}

export default function ProfileForm({ suggestion, initial }: ProfileFormProps) {
  const router = useRouter()
  const suggested = suggestion.sources.length > 0

  // Defaults are the suggestion, so "dirty" means "changed from what One Marketing Command Center suggested".
  const form = useForm<BusinessProfile>({
    resolver: zodResolver(profileSchema),
    defaultValues: suggestion.profile,
  })
  const { dirtyFields } = form.formState

  useEffect(() => {
    if (initial) form.reset(initial, { keepDefaultValues: true })
  }, [form, initial])

  function status(section: keyof BusinessProfile): SectionStatus {
    if (dirtyFields[section]) return "edited"
    return suggested ? "suggested" : null
  }

  function onSubmit(profile: BusinessProfile) {
    saveDraft({ profile })
    router.push("/setup/creatives")
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <Section
        icon={MapPin}
        iconClassName="bg-sky-100 text-sky-600"
        title="Location"
        description="Where your ads will show."
        status={status("location")}
      >
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <Controller
            name="location.address"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="address">Address</FieldLabel>
                <Input
                  {...field}
                  id="address"
                  placeholder="599 3rd St, San Francisco, CA"
                  autoComplete="street-address"
                  aria-invalid={fieldState.invalid}
                  className={inputClass}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="location.zip"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="zip">ZIP code</FieldLabel>
                <Input
                  {...field}
                  id="zip"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="94107"
                  autoComplete="postal-code"
                  aria-invalid={fieldState.invalid}
                  className={inputClass}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>

        <Controller
          name="location.targetZips"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="targetZips">Target these ZIP codes</FieldLabel>
              <KeywordInput
                id="targetZips"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Type a ZIP code and press Enter"
                inputMode="numeric"
                parse={parseZip}
                rejectMessage="Use a 5-digit ZIP code."
                invalid={fieldState.invalid}
                chipClassName="bg-sky-100 text-sky-800 tabular-nums"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          name="location.radiusMiles"
          control={form.control}
          render={({ field }) => (
            <FieldSet className="gap-2">
              <FieldLegend variant="label">Radius around your address</FieldLegend>
              <ChoiceGroup
                name={field.name}
                options={radiusChoices}
                value={field.value}
                onChange={field.onChange}
                className="self-start"
              />
            </FieldSet>
          )}
        />
      </Section>

      <Section
        icon={Sparkles}
        iconClassName="bg-fuchsia-100 text-fuchsia-600"
        title="Brand"
        description="How your ads should sound and feel."
        status={status("brand")}
      >
        <Controller
          name="brand"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="brand" className="sr-only">
                Brand keywords
              </FieldLabel>
              <KeywordInput
                id="brand"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Hidden gem, Playful"
                invalid={fieldState.invalid}
                chipClassName="bg-fuchsia-100 text-fuchsia-800"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </Section>

      <Section
        icon={Coffee}
        iconClassName="bg-orange-100 text-orange-600"
        title="Products"
        description="What to feature in your ads."
        status={status("products")}
      >
        <Controller
          name="products"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="products" className="sr-only">
                Products and services
              </FieldLabel>
              <KeywordInput
                id="products"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Signature latte, Pastries"
                invalid={fieldState.invalid}
                chipClassName="bg-orange-100 text-orange-800"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </Section>

      <Section
        icon={Users}
        iconClassName="bg-emerald-100 text-emerald-600"
        title="Audience"
        description="Who should see your ads."
        status={status("audience")}
      >
        <Controller
          name="audience.keywords"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="audience">Who they are</FieldLabel>
              <KeywordInput
                id="audience"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Office workers, Commuters"
                invalid={fieldState.invalid}
                chipClassName="bg-emerald-100 text-emerald-800"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="flex flex-wrap gap-x-10 gap-y-6">
          <FieldSet className="gap-2">
            <FieldLegend variant="label">Age</FieldLegend>
            <div className="flex items-center gap-3">
              <Controller
                name="audience.ageMin"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    {...numberFieldProps(field)}
                    onBlur={field.onBlur}
                    type="number"
                    min={AGE_MIN}
                    max={AGE_MAX}
                    aria-label="Youngest age"
                    aria-invalid={fieldState.invalid}
                    className={cn(inputClass, "w-20 text-center tabular-nums")}
                  />
                )}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Controller
                name="audience.ageMax"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    {...numberFieldProps(field)}
                    onBlur={field.onBlur}
                    type="number"
                    min={AGE_MIN}
                    max={AGE_MAX}
                    aria-label="Oldest age"
                    aria-invalid={fieldState.invalid}
                    className={cn(inputClass, "w-20 text-center tabular-nums")}
                  />
                )}
              />
            </div>
            <FieldDescription>
              {AGE_MAX} means {AGE_MAX} and over.
            </FieldDescription>
            <FieldError
              errors={[
                form.formState.errors.audience?.ageMin,
                form.formState.errors.audience?.ageMax,
              ]}
            />
          </FieldSet>

          <Controller
            name="audience.gender"
            control={form.control}
            render={({ field }) => (
              <FieldSet className="gap-2">
                <FieldLegend variant="label">Gender</FieldLegend>
                <ChoiceGroup
                  name={field.name}
                  options={genderOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FieldSet>
            )}
          />
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3 pt-4">
        <Link
          href="/setup"
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 rounded-xl px-4")}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        {form.formState.isDirty && suggested && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => {
              form.reset(suggestion.profile)
            }}
            className="h-12 rounded-xl px-4 text-muted-foreground"
          >
            <RotateCcw className="size-4" />
            Reset to suggestions
          </Button>
        )}
        <Button type="submit" size="lg" className={cn(primaryButtonClass, "ml-auto")}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  )
}
