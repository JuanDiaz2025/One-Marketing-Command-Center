"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Globe } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { categoryVisuals } from "@/components/setup/category-visuals"
import { inputClass, primaryButtonClass } from "@/components/setup/styles"
import { demoBusiness } from "@/lib/demo"
import {
  businessCategories,
  businessSchema,
  loadDraft,
  saveDraft,
  type BusinessDetails,
} from "@/lib/setup"

const DESCRIPTION_MAX = 500

export default function BusinessForm() {
  const router = useRouter()

  const form = useForm<BusinessDetails>({
    resolver: zodResolver(businessSchema),
    defaultValues: demoBusiness,
  })

  // Restore earlier answers so owners can come back to the form.
  useEffect(() => {
    const { business } = loadDraft()
    if (business) form.reset(business)
  }, [form])

  function onSubmit(values: BusinessDetails) {
    saveDraft({ business: values })
    router.push("/setup/profile")
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8" noValidate>
      <FieldGroup className="gap-7">
        <Controller
          name="businessName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="businessName" className="text-base">
                Business name
              </FieldLabel>
              <Input
                {...field}
                id="businessName"
                placeholder="Joe's Bakery"
                autoComplete="organization"
                aria-invalid={fieldState.invalid}
                className={inputClass}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          name="category"
          control={form.control}
          render={({ field, fieldState }) => (
            <FieldSet data-invalid={fieldState.invalid} className="gap-3">
              <FieldLegend>What kind of business is it?</FieldLegend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {businessCategories.map((category) => {
                  const visual = categoryVisuals[category.value]
                  const Icon = visual.icon
                  return (
                    <label
                      key={category.value}
                      className={cn(
                        "group flex cursor-pointer flex-col gap-3 rounded-2xl border-2 border-transparent bg-card p-4 shadow-xs ring-1 ring-border transition-all",
                        "hover:-translate-y-0.5 hover:shadow-md",
                        "has-checked:shadow-md has-checked:ring-0",
                        "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        visual.selected,
                      )}
                    >
                      <input
                        type="radio"
                        name={field.name}
                        value={category.value}
                        checked={field.value === category.value}
                        onChange={() => field.onChange(category.value)}
                        onBlur={field.onBlur}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl transition-transform group-has-checked:scale-110",
                          visual.chip,
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="text-sm leading-snug font-medium">{category.label}</span>
                    </label>
                  )
                })}
              </div>
              <FieldError errors={[fieldState.error]} />
            </FieldSet>
          )}
        />

        <Controller
          name="website"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="website" className="text-base">
                Website <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <div className="relative">
                <Globe className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  {...field}
                  id="website"
                  type="url"
                  inputMode="url"
                  placeholder="joesbakery.com"
                  autoComplete="url"
                  aria-invalid={fieldState.invalid}
                  className={cn(inputClass, "pl-10")}
                />
              </div>
              <FieldDescription>
                Where people go when they click your ad. No website? Leave this blank.
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="description" className="text-base">
                Describe your business{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Textarea
                {...field}
                id="description"
                rows={5}
                maxLength={DESCRIPTION_MAX}
                placeholder="A family-run bakery in Austin. We bake sourdough and pastries fresh every morning and take custom cake orders for birthdays and weddings."
                aria-invalid={fieldState.invalid}
                className="min-h-36 rounded-xl bg-card px-4 py-3 text-base leading-relaxed shadow-xs md:text-base"
              />
              <FieldDescription className="flex justify-between gap-4">
                <span>What you sell, who it&apos;s for, and what makes you different.</span>
                <span className="shrink-0 tabular-nums">
                  {field.value.length}/{DESCRIPTION_MAX}
                </span>
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>

      <div className="flex flex-wrap items-center justify-end gap-4 border-t pt-8">
        <Button type="submit" size="lg" className={primaryButtonClass}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  )
}
