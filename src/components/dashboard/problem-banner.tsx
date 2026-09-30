import { CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react"

import type { Issue } from "@/lib/google/health"
import { cn } from "@/lib/utils"

// The first thing on the dashboard: whether anything in Google Ads needs fixing, and the worst of it.
export default function ProblemBanner({ issues }: { issues: Issue[] }) {
  const serious = issues.filter((i) => i.severity === "high")
  if (!issues.length) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-emerald-600/30 bg-emerald-500/10 p-5 sm:px-6">
        <CircleCheck className="size-7 shrink-0 text-emerald-600" />
        <div>
          <h2 className="text-lg font-semibold">All clear</h2>
          <p className="text-sm text-muted-foreground">No problems found in your Google Ads for this period.</p>
        </div>
      </section>
    )
  }

  const bad = serious.length > 0
  const Icon = bad ? OctagonAlert : TriangleAlert
  const top = [...serious, ...issues.filter((i) => i.severity !== "high")].slice(0, 3)

  return (
    <section
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 p-5 sm:px-6",
        bad ? "border-destructive/50 bg-destructive/10" : "border-amber-500/50 bg-amber-500/10",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("size-7 shrink-0", bad ? "text-destructive" : "text-amber-600")} />
        <div>
          <h2 className="text-lg font-semibold">
            {bad
              ? `${serious.length} serious problem${serious.length === 1 ? "" : "s"} in your Google Ads`
              : `${issues.length} thing${issues.length === 1 ? "" : "s"} to fix in your Google Ads`}
            {bad && issues.length > serious.length && (
              <span className="font-normal text-muted-foreground">, {issues.length - serious.length} more to look at</span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">Fix these first, most serious at the top.</p>
        </div>
      </div>
      <ol className="flex flex-col gap-1.5 pl-10 text-sm">
        {top.map((i) => (
          <li key={i.id} className="flex items-start gap-2">
            <span
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                i.severity === "high" ? "bg-destructive" : "bg-amber-500",
              )}
            />
            <span className="font-medium">{i.title}</span>
          </li>
        ))}
      </ol>
      <div className="pl-10">
        <a
          href="#health"
          className={cn(
            "inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white",
            bad ? "bg-destructive hover:bg-destructive/90" : "bg-amber-600 hover:bg-amber-700",
          )}
        >
          See all {issues.length} and how to fix them
        </a>
      </div>
    </section>
  )
}
