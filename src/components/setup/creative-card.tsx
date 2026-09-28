import { cn } from "@/lib/utils"
import type { CreativeVariation } from "@/lib/setup"

// Accent colors for the band and sticker layouts, cycled across variations.
const accents = [
  "bg-amber-300 text-amber-950",
  "bg-fuchsia-500 text-white",
  "bg-sky-400 text-sky-950",
  "bg-lime-300 text-lime-950",
  "bg-orange-500 text-white",
  "bg-violet-500 text-white",
]

type CreativeCardProps = {
  variation: CreativeVariation
  businessName: string
  photoUrl?: string
  accentIndex: number
}

// A 9:16 story ad. Shows the finished creative if there is one; otherwise draws a mock from the
// owner's photo. Text is sized in container units (cqw) so it scales with the card.
export default function CreativeCard({
  variation,
  businessName,
  photoUrl,
  accentIndex,
}: CreativeCardProps) {
  const accent = accents[accentIndex % accents.length]
  const { layout } = variation

  if (variation.image) {
    return (
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={variation.image} alt={variation.headline} className="size-full object-cover" />
      </div>
    )
  }

  const cta = (
    <span
      className={cn(
        "block rounded-full py-[2.5cqw] text-center text-[4.4cqw] font-semibold",
        layout === "band" ? "bg-slate-950 text-white" : "bg-white text-slate-950",
      )}
    >
      {variation.cta}
    </span>
  )

  return (
    <div className="@container relative aspect-[9/16] overflow-hidden rounded-2xl bg-slate-900 text-white">
      {/* Photo */}
      <div
        className={cn("absolute inset-x-0 top-0", layout === "band" ? "bottom-[34%]" : "bottom-0")}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-gradient-to-br from-slate-600 to-slate-800" />
        )}
      </div>
      {layout === "sticker" && <div className="absolute inset-0 bg-black/30" />}

      {/* Story chrome */}
      <div className="absolute inset-x-0 top-0 flex flex-col gap-[3cqw] bg-gradient-to-b from-black/55 to-transparent p-[4cqw] pb-[10cqw]">
        <div className="flex gap-[1.5cqw]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn("h-[0.9cqw] flex-1 rounded-full", i === 0 ? "bg-white" : "bg-white/40")}
            />
          ))}
        </div>
        <div className="flex items-center gap-[2.5cqw]">
          <span className="flex size-[8cqw] items-center justify-center rounded-full bg-white text-[4cqw] font-bold text-slate-900">
            {businessName.charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[4.2cqw] font-semibold">{businessName}</span>
            <span className="text-[3.6cqw] opacity-80">Sponsored</span>
          </span>
        </div>
      </div>

      {layout === "overlay" && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[2cqw] bg-gradient-to-t from-black/90 via-black/50 to-transparent p-[5cqw] pt-[24cqw]">
          <p className="text-[8.5cqw] leading-[1.05] font-bold text-balance">
            {variation.headline}
          </p>
          <p className="text-[4.4cqw] opacity-85">{variation.subline}</p>
          <div className="mt-[2cqw]">{cta}</div>
        </div>
      )}

      {layout === "band" && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex h-[34%] flex-col justify-between p-[5cqw]",
            accent,
          )}
        >
          <div className="flex flex-col gap-[1.5cqw]">
            <p className="text-[7.5cqw] leading-[1.05] font-extrabold text-balance">
              {variation.headline}
            </p>
            <p className="text-[4.2cqw] opacity-80">{variation.subline}</p>
          </div>
          {cta}
        </div>
      )}

      {layout === "sticker" && (
        <>
          <span
            className={cn(
              "absolute top-[27cqw] left-[5cqw] -rotate-3 rounded-[2cqw] px-[3cqw] py-[1.5cqw] text-[4cqw] font-bold tracking-wide uppercase shadow-lg",
              accent,
            )}
          >
            {variation.angle}
          </span>
          <p className="absolute inset-x-[6cqw] top-1/2 -translate-y-1/2 text-[10.5cqw] leading-[1.02] font-extrabold text-balance drop-shadow-lg">
            {variation.headline}
          </p>
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[3cqw] p-[5cqw]">
            <p className="text-[4.4cqw] opacity-90">{variation.subline}</p>
            {cta}
          </div>
        </>
      )}
    </div>
  )
}
