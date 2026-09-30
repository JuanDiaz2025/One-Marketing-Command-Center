"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

export type Tab = {
  id: string
  label: string
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
      <div role="tablist" aria-label="Dashboard sections" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => open(t.id)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              active === t.id
                ? "border-primary bg-primary text-primary-foreground"
                : t.tone === "bad"
                  ? "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"
                  : t.tone === "warn"
                    ? "border-amber-500/40 bg-amber-500/5 text-amber-800 hover:bg-amber-500/10"
                    : "bg-card hover:bg-muted",
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
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
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  )
}
