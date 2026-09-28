import {
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cookie,
  Mail,
  Megaphone,
  Phone,
  RefreshCw,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

type Direction = "right" | "down" | "left" | "up"

const arrowHeads: Record<Direction, LucideIcon> = {
  right: ChevronRight,
  down: ChevronDown,
  left: ChevronLeft,
  up: ChevronUp,
}

// A dashed arrow that stretches to fill its grid cell, with dashes marching toward the head.
function Arrow({
  direction,
  label,
  highlight,
  children,
}: {
  direction: Direction
  label?: string
  highlight?: boolean
  children?: React.ReactNode
}) {
  const vertical = direction === "up" || direction === "down"
  const Head = arrowHeads[direction]
  // Lines are drawn in the direction of travel so the dash animation flows the right way.
  const [x1, y1, x2, y2] = {
    right: [0, 6, 100, 6],
    left: [100, 6, 0, 6],
    down: [6, 0, 6, 100],
    up: [6, 100, 6, 0],
  }[direction]

  const line = (
    <div className={cn("relative", vertical ? "h-full w-3" : "h-3 w-full")}>
      <svg
        viewBox={vertical ? "0 0 12 100" : "0 0 100 12"}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden
      >
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          strokeDasharray="6 6"
          vectorEffect="non-scaling-stroke"
          className={cn(
            "animate-dash-flow",
            highlight
              ? "stroke-lime-300 [stroke-width:2.5] drop-shadow-[0_0_6px_rgb(190_242_100/0.8)]"
              : "stroke-white/40 [stroke-width:1.5]",
          )}
        />
      </svg>
      <Head
        strokeWidth={highlight ? 3 : 2.5}
        className={cn(
          "absolute size-4",
          highlight ? "text-lime-300" : "text-white/50",
          direction === "right" && "top-1/2 -right-1.5 -translate-y-1/2",
          direction === "left" && "top-1/2 -left-1.5 -translate-y-1/2",
          direction === "down" && "-bottom-1.5 left-1/2 -translate-x-1/2",
          direction === "up" && "-top-1.5 left-1/2 -translate-x-1/2",
        )}
      />
    </div>
  )

  if (vertical) {
    return (
      <div
        className={cn(
          "flex h-full items-stretch gap-3 py-2",
          direction === "down" ? "flex-row-reverse justify-start" : "justify-start",
          "px-6",
        )}
      >
        {line}
        <div className="flex flex-col justify-center gap-1.5">
          {label && (
            <span
              className={cn(
                "text-xs font-medium",
                highlight ? "text-lime-300" : "text-white/60",
                direction === "down" && "text-right",
              )}
            >
              {label}
            </span>
          )}
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col justify-center gap-1 px-1">
      {label && (
        <span className="hidden text-center text-[11px] leading-tight text-white/60 sm:block">
          {label}
        </span>
      )}
      {line}
    </div>
  )
}

function Node({
  icon: Icon,
  title,
  detail,
  tone = "default",
}: {
  icon: LucideIcon
  title: string
  detail: string
  tone?: "brand" | "success" | "default"
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-2xl p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4",
        tone === "brand" &&
          "bg-gradient-to-br from-orange-400 via-pink-500 to-violet-600 shadow-lg shadow-pink-500/30",
        tone === "success" && "bg-emerald-400/15 ring-1 ring-emerald-300/40",
        tone === "default" && "bg-white/10 ring-1 ring-white/15",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          tone === "brand"
            ? "bg-white/20"
            : tone === "success"
              ? "bg-emerald-400/25"
              : "bg-white/10",
        )}
      >
        <Icon className={cn("size-5", tone === "success" ? "text-emerald-300" : "text-white")} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">{title}</span>
        <span className={cn("text-xs", tone === "brand" ? "text-white/85" : "text-white/65")}>
          {detail}
        </span>
      </span>
    </div>
  )
}

type FeedbackLoopProps = {
  // Selected platforms and conversion sources, so the diagram matches the form.
  platforms: string[]
  sources: string[]
}

// Diagram of the conversion feedback loop: targeting picks the audience, the campaign reaches
// customers, their conversions are counted, and those feed back into targeting.
export default function FeedbackLoop({ platforms, sources }: FeedbackLoopProps) {
  const identifiers = [
    { icon: Mail, label: "Emails" },
    { icon: Phone, label: "Phone numbers" },
    { icon: Cookie, label: "Cookies" },
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[oklch(0.22_0.07_285)] p-5 text-white sm:p-7">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -left-10 size-56 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <div className="absolute -right-10 -bottom-20 size-64 rounded-full bg-emerald-400/20 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <p className="text-lg font-semibold">
            Conversions are critical for effective ad targeting.
          </p>
          <p className="text-sm text-pretty text-white/75">
            Every conversion feeds back into all your ad platforms automatically, matched by email,
            phone number, or cookie. The platforms learn who your real customers are and find more
            people like them.
          </p>
        </div>

        <div
          role="img"
          aria-label="Feedback loop: the targeting algorithm picks who sees your ads, your campaign reaches customers, their conversions are counted, and the conversions feed back into the targeting algorithm by email, phone number, and cookie."
          className="grid grid-cols-[minmax(0,1fr)_minmax(2.5rem,6rem)_minmax(0,1fr)] grid-rows-[auto_minmax(7.5rem,auto)_auto]"
        >
          <Node
            icon={BrainCircuit}
            title="Targeting algorithm"
            detail="Picks who sees which ad"
            tone="brand"
          />
          <Arrow direction="right" label="Shows the right ad" />
          <Node
            icon={Megaphone}
            title="Your campaign"
            detail={`Ads on ${platforms.length ? platforms.join(" and ") : "your platforms"}`}
          />

          <Arrow direction="up" label="Feeds back" highlight>
            <div className="flex flex-col gap-1">
              {identifiers.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full bg-lime-300/15 px-2.5 py-1 text-xs text-lime-100 ring-1 ring-lime-300/30"
                >
                  <Icon className="size-3 text-lime-300" />
                  {label}
                </span>
              ))}
            </div>
          </Arrow>
          <div className="flex flex-col items-center justify-center gap-2 px-1 text-center">
            <RefreshCw className="size-7 animate-[spin_8s_linear_infinite] text-lime-300" />
            <span className="hidden text-[11px] leading-tight text-white/70 sm:block">
              Every conversion makes the next ad smarter
            </span>
          </div>
          <Arrow direction="down" label="Reaches locals" />

          <Node
            icon={Target}
            title="Conversions"
            detail={sources.length ? sources.join(", ") : "Add a source below"}
            tone="success"
          />
          <Arrow direction="left" label="They visit or buy" />
          <Node icon={Users} title="Customers" detail="See your ad, then come in" />
        </div>
      </div>
    </div>
  )
}
