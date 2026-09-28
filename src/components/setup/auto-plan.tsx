import { Megaphone, MapPin, Package, Sparkles, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import FormatPreview from "@/components/format-preview"
import { currency } from "@/components/setup/form-parts"
import { platformOptions, type CampaignSuggestion, type Platform } from "@/lib/setup"

const basedOnIcons = { location: MapPin, audience: Users, product: Package, ads: Megaphone }

const platformBars: Record<Platform, string> = {
  meta: "from-blue-500 to-violet-500 text-white",
  google: "from-amber-400 to-emerald-400 text-slate-900",
}

type AutoPlanProps = {
  businessName: string
  suggestion: CampaignSuggestion
  platforms: Platform[]
  monthly: number
  metaShare: number
  // The owner's picked ads, shown inside the format previews.
  adImages: string[]
}

// What auto mode does, spelled out: the budget split and the placements it picked on each
// platform, and what about the business it based them on.
export default function AutoPlan({
  businessName,
  suggestion,
  platforms,
  monthly,
  metaShare,
  adImages,
}: AutoPlanProps) {
  const active = platformOptions.filter((p) => platforms.includes(p.value))
  const shareOf = (platform: Platform) => (platform === "meta" ? metaShare : 100 - metaShare)
  let imageIndex = 0
  const nextImage = () => (adImages.length ? adImages[imageIndex++ % adImages.length] : undefined)

  return (
    <div className="rounded-3xl bg-gradient-to-br from-primary via-fuchsia-500 to-orange-400 p-[2px] shadow-lg shadow-primary/15">
      <div className="flex flex-col gap-6 rounded-[calc(1.5rem-2px)] bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-md shadow-primary/30">
            <Sparkles className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold tracking-tight">
              AdPilot&apos;s plan for {businessName}
            </h3>
            <p className="text-sm text-pretty text-muted-foreground">
              We used what we know about your business to split your budget and pick where your ads
              show. We&apos;ll keep shifting it toward whatever brings in customers.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Based on
          </span>
          {suggestion.basedOn.map(({ kind, label }) => {
            const Icon = basedOnIcons[kind]
            return (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
              >
                <Icon className="size-3" />
                {label}
              </span>
            )
          })}
        </div>

        {active.length === 2 && (
          <div className="flex h-9 overflow-hidden rounded-xl text-sm font-semibold">
            {active.map((platform) => (
              <div
                key={platform.value}
                className={cn(
                  "flex items-center justify-center bg-gradient-to-r transition-all",
                  platformBars[platform.value],
                )}
                style={{ width: `${shareOf(platform.value)}%` }}
              >
                {platform.label} {shareOf(platform.value)}%
              </div>
            ))}
          </div>
        )}

        <div className={cn("grid gap-6", active.length === 2 && "md:grid-cols-2")}>
          {active.map((platform) => {
            const platformAmount =
              active.length === 2 ? Math.round((monthly * shareOf(platform.value)) / 100) : monthly
            return (
              <div key={platform.value} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="font-semibold">{platform.label}</h4>
                    <p className="text-sm">
                      <span className="text-xl font-semibold tabular-nums">
                        {currency.format(platformAmount)}
                      </span>
                      <span className="text-muted-foreground"> /mo</span>
                    </p>
                  </div>
                  <p className="text-sm text-pretty text-muted-foreground">
                    {suggestion.splitReasons[platform.value]}
                  </p>
                </div>
                <ul className="flex flex-col gap-2">
                  {suggestion.channels[platform.value].map((channel) => (
                    <li
                      key={channel.name}
                      className="flex items-center gap-3.5 rounded-2xl bg-muted/60 p-2.5 pr-3.5"
                    >
                      <FormatPreview
                        format={channel.format}
                        image={
                          channel.format === "vertical" || channel.format === "feed"
                            ? nextImage()
                            : undefined
                        }
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="text-sm font-semibold">{channel.name}</p>
                        <p className="text-xs font-medium text-primary">{channel.formatLabel}</p>
                        <p className="text-xs text-pretty text-muted-foreground">
                          {channel.detail}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end">
                        <span className="text-sm font-semibold tabular-nums">
                          {currency.format((platformAmount * channel.share) / 100)}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {channel.share}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
