"use client"

import { useEffect, useState } from "react"
import {
  CalendarClock,
  ChartLine,
  Gauge,
  KeyRound,
  Layers,
  MapPin,
  Megaphone,
  MonitorSmartphone,
  Target,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

// Icons by name: the server page can't pass icon components to this client component.
const icons: Record<string, LucideIcon> = {
  overview: Gauge,
  problems: TriangleAlert,
  wasted: Trash2,
  locations: MapPin,
  campaigns: Layers,
  keywords: KeyRound,
  ads: Megaphone,
  devices: MonitorSmartphone,
  times: CalendarClock,
  conversions: Target,
  trends: ChartLine,
}

export type Tab = {
  id: string
  label: string
  icon?: keyof typeof icons
  // A count shown on the tab, e.g. how many problems or searches to remove.
  count?: number
  // "bad" marks a tab with a serious problem, "warn" one worth a look.
  tone?: "bad" | "warn"
  content: React.ReactNode
}

// The dashboard's sections as tabs, all visible at once, so nothing needs a long scroll. The tab
// follows the address bar (#health, #wasted, ...), so links like "See all problems" open it.
export default function DashboardTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id)

  useEffect(() => {
    const fromHash = (event?: Event) => {
      const id = window.location.hash.slice(1)
      if (!tabs.some((t) => t.id === id)) return
      setActive(id)
      // A link like "See all problems" jumps to the tabs; the section itself was hidden until now.
      if (event) requestAnimationFrame(() => document.getElementById("sections")?.scrollIntoView({ block: "start" }))
    }
    fromHash()
    window.addEventListener("hashchange", fromHash)
    return () => window.removeEventListener("hashchange", fromHash)
  }, [tabs])

  const open = (id: string) => {
    setActive(id)
    history.replaceState(null, "", `#${id}`)
  }

  return (
    <div id="sections" className="flex scroll-mt-20 flex-col gap-4">
      {/* Stays under the header while scrolling on bigger screens (the header is h-16 there). */}
      <div
        role="tablist"
        aria-label="Dashboard sections"
        className="z-10 -mx-4 flex flex-wrap gap-2 border-y bg-background/95 px-4 py-3 backdrop-blur sm:sticky sm:top-16 sm:-mx-6 sm:px-6"
      >
        {tabs.map((t) => {
          const Icon = t.icon ? icons[t.icon] : null
          return (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => open(t.id)}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl border-2 px-4 text-[15px] font-semibold shadow-sm transition-colors",
              active === t.id
                ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                : t.tone === "bad"
                  ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/15"
                  : t.tone === "warn"
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20"
                    : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            {Icon && <Icon className="size-4.5 shrink-0" />}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold tabular-nums",
                  active === t.id
                    ? "bg-primary-foreground/20"
                    : t.tone === "bad"
                      ? "bg-destructive text-white"
                      : t.tone === "warn"
                        ? "bg-amber-500 text-white"
                        : "bg-muted",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
          )
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  )
}
