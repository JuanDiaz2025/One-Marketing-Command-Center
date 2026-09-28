"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

export type BarItem = {
  key: string
  label: string
  value: number
  valueLabel: string
  barClassName: string
  details?: string[] // extra lines shown on hover
}

// Horizontal bars with the value at the tip and a hover/tap tooltip.
export default function BarList({ items, max, labelWidth = "6.5rem" }: { items: BarItem[]; max?: number; labelWidth?: string }) {
  const [active, setActive] = useState<string | null>(null)
  const top = max ?? Math.max(...items.map((i) => i.value))

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const ratio = top ? item.value / top : 0
        const isActive = active === item.key
        return (
          <li
            key={item.key}
            className="relative grid items-center gap-3 text-sm"
            style={{ gridTemplateColumns: `${labelWidth} minmax(0,1fr)` }}
            onPointerEnter={() => setActive(item.key)}
            onPointerLeave={() => setActive(null)}
            onClick={() => setActive(isActive ? null : item.key)}
          >
            <span className="truncate text-muted-foreground">{item.label}</span>
            <div className="flex items-center gap-2 py-1">
              <div
                className={cn("h-5 rounded-r-[4px] transition-opacity", item.barClassName, active && !isActive && "opacity-40")}
                // Leave room for the value label so the longest bar still fits.
                style={{ width: `max(calc((100% - 4.5rem) * ${ratio}), 4px)` }}
              />
              <span className="shrink-0 font-medium tabular-nums">{item.valueLabel}</span>
            </div>
            {isActive && item.details && (
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-8 z-10 mb-1 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
              >
                <p className="font-medium">{item.label}</p>
                {item.details.map((d) => (
                  <p key={d} className="text-muted-foreground">{d}</p>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
