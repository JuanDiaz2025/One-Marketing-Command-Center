import { Check, FlaskConical, TrendingUp, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import CreativeCard from "@/components/setup/creative-card"
import { MIN_CREATIVE_PICKS, type CreativeVariation, type UploadedPhoto } from "@/lib/setup"

type CreativePickerProps = {
  creatives: CreativeVariation[]
  photos: UploadedPhoto[]
  businessName: string
  selected: string[]
  onChange: (selected: string[]) => void
  invalid?: boolean
}

export function TestingBanner() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[oklch(0.22_0.07_285)] p-6 text-white sm:p-7">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -right-10 size-56 rounded-full bg-fuchsia-500/40 blur-3xl" />
        <div className="absolute -bottom-24 left-10 size-56 rounded-full bg-cyan-400/25 blur-3xl" />
      </div>
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
          <FlaskConical className="size-6 text-lime-300" />
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <h2 className="text-lg font-semibold">
            Pick the ones you like. Meta and Google find the winner.
          </h2>
          <p className="text-sm text-pretty text-white/75">
            Your picks run side by side as an automatic A/B test. The platforms learn which ads
            bring in the most customers and put more of your budget behind them. The more you pick,
            the more they can test.
          </p>
        </div>
        {/* A tiny test result: the winning ad pulls ahead. */}
        <div aria-hidden className="flex shrink-0 items-end gap-2 self-start sm:self-center">
          {[40, 64, 28, 88].map((height, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              {i === 3 && <TrendingUp className="size-4 text-lime-300" />}
              <div
                className={cn("w-5 rounded-md", i === 3 ? "bg-lime-300" : "bg-white/25")}
                style={{ height }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CreativePicker({
  creatives,
  photos,
  businessName,
  selected,
  onChange,
  invalid,
}: CreativePickerProps) {
  const allSelected = selected.length === creatives.length

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className={cn("text-sm", invalid ? "text-destructive" : "text-muted-foreground")}>
          {selected.length} of {creatives.length} selected
          {selected.length < MIN_CREATIVE_PICKS && ` · pick at least ${MIN_CREATIVE_PICKS}`}
        </p>
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : creatives.map((c) => c.id))}
          className="text-sm font-medium text-primary hover:underline"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3">
        {creatives.map((creative, index) => {
          const isSelected = selected.includes(creative.id)
          // Mock ads (no finished image) are drawn over the photo they were made from.
          const sourcePhoto = photos.length
            ? photos[creative.sourcePhotos[0] % photos.length]
            : undefined
          return (
            <li key={creative.id}>
              <label className="group flex cursor-pointer flex-col gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(creative.id)}
                  className="peer sr-only"
                />

                <div
                  className={cn(
                    "rounded-[1.25rem] p-1 transition-all duration-200",
                    "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                    isSelected
                      ? "bg-gradient-to-br from-primary via-fuchsia-500 to-orange-400 shadow-xl shadow-primary/25"
                      : "bg-transparent group-hover:-translate-y-1",
                  )}
                >
                  <div
                    className={cn(
                      "transition-opacity",
                      selected.length > 0 && !isSelected && "opacity-60 group-hover:opacity-100",
                    )}
                  >
                    <CreativeCard
                      variation={creative}
                      businessName={businessName}
                      photoUrl={sourcePhoto?.url}
                      accentIndex={index}
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3 px-1">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold">{creative.angle}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3 shrink-0" />
                      {creative.audience}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "text-transparent ring-2 ring-border group-hover:ring-primary/50",
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                </div>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
