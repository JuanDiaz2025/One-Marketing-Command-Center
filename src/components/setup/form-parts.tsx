import { Pencil, Sparkles, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Number inputs hold NaN while empty so zod reports "enter a number" instead of treating it as 0.
export function numberFieldProps(field: { value: number; onChange: (value: number) => void }) {
  return {
    value: Number.isNaN(field.value) ? "" : field.value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      field.onChange(e.target.value === "" ? NaN : Number(e.target.value)),
  }
}

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

// "suggested" until the owner changes something AdPilot filled in, then "edited".
export type SectionStatus = "suggested" | "edited" | null

// A card for one part of a setup form, with a colored icon and a Suggested/Edited badge.
export function Section({
  icon: Icon,
  iconClassName,
  title,
  description,
  status,
  children,
}: {
  icon: LucideIcon
  iconClassName: string
  title: string
  description: string
  status: SectionStatus
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-6 rounded-3xl bg-card p-6 shadow-xs ring-1 ring-border sm:p-7">
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            iconClassName,
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {status === "suggested" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-primary/10 to-fuchsia-500/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3" />
            Suggested
          </span>
        )}
        {status === "edited" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Pencil className="size-3" />
            Edited
          </span>
        )}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  )
}
