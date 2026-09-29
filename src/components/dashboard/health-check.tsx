import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react"

import AskButton from "@/components/dashboard/ask-button"
import Paged from "@/components/ui/paged"
import type { Issue } from "@/lib/google/health"
import { cn } from "@/lib/utils"

// Problems in the ad account worth fixing, most serious first.
export default function HealthCheck({ issues }: { issues: Issue[] }) {
  if (!issues.length) {
    return (
      <section id="health" className="flex items-center gap-3 rounded-2xl border border-emerald-600/20 bg-emerald-500/5 p-5 sm:px-6">
        <CircleCheck className="size-6 shrink-0 text-emerald-600" />
        <div>
          <h2 className="font-semibold">No problems found</h2>
          <p className="text-sm text-muted-foreground">
            Ads are approved, campaigns can run, and spend is turning into conversions.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section id="health" className="scroll-mt-20 rounded-2xl border bg-card shadow-xs">
      <div className="flex items-start gap-3 px-5 pt-5 sm:px-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
          <TriangleAlert className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">
            Needs attention ({issues.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Things in your Google Ads worth fixing, most serious first.
          </p>
        </div>
      </div>
      <Paged
        noun="problems"
        pageSize={5}
        listClassName="mt-4 divide-y border-t"
        items={issues.map((issue) => (
          <li key={issue.id} className="flex flex-col gap-2 px-5 py-4 sm:px-6">
            <div className="flex items-start gap-2">
              <CircleAlert
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  issue.severity === "high" ? "text-destructive" : "text-amber-600",
                )}
                aria-label={issue.severity === "high" ? "Serious" : "Worth a look"}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-medium">{issue.title}</p>
                <p className="text-sm text-muted-foreground">{issue.detail}</p>
                <p className="text-sm">
                  <span className="font-medium">How to fix: </span>
                  {issue.fix}
                </p>
              </div>
            </div>
            <div className="pl-6">
              <AskButton question={issue.question} />
            </div>
          </li>
        ))}
      />
    </section>
  )
}
