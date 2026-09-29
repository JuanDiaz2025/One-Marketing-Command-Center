import Link from "next/link"
import { CalendarDays } from "lucide-react"

import { Button } from "@/components/ui/button"
import { presets, type Period } from "@/lib/google/period"
import { cn } from "@/lib/utils"

// Preset ranges as links, plus exact dates picked on the browser's calendar. A plain GET form,
// so it works without JavaScript and the chosen dates stay in the address bar.
export default function PeriodPicker({ period }: { period: Period }) {
  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "bg-card text-muted-foreground hover:text-foreground",
    )

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
      <nav aria-label="Date range" className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard?range=${p.id}`}
            aria-current={period.preset === p.id ? "page" : undefined}
            className={pill(period.preset === p.id)}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <form action="/dashboard" className="flex flex-wrap items-center gap-2">
        <CalendarDays
          aria-hidden="true"
          className={cn("size-4", period.preset === "custom" ? "text-primary" : "text-muted-foreground")}
        />
        <label className="sr-only" htmlFor="from">
          From
        </label>
        <input
          id="from"
          name="from"
          type="date"
          required
          max={period.today}
          min="2000-01-01"
          defaultValue={period.start > "2000-01-01" ? period.start : undefined}
          className={cn(
            "h-9 rounded-lg border bg-card px-2 text-sm",
            period.preset === "custom" && "border-primary",
          )}
        />
        <span className="text-muted-foreground">to</span>
        <label className="sr-only" htmlFor="to">
          To
        </label>
        <input
          id="to"
          name="to"
          type="date"
          required
          max={period.today}
          min="2000-01-01"
          defaultValue={period.end}
          className={cn(
            "h-9 rounded-lg border bg-card px-2 text-sm",
            period.preset === "custom" && "border-primary",
          )}
        />
        <Button type="submit" variant={period.preset === "custom" ? "default" : "outline"} size="lg">
          Apply
        </Button>
      </form>
    </div>
  )
}
