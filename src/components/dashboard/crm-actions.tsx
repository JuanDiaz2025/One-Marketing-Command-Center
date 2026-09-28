import { ArrowDown, ArrowUp, Minus } from "lucide-react"

import type { CrmAction, Priority } from "@/lib/dashboard-data"
import { cn } from "@/lib/utils"

const priorityStyle: Record<Priority, { icon: typeof ArrowUp; className: string }> = {
  High: { icon: ArrowUp, className: "bg-red-500/10 text-red-700 dark:text-red-300" },
  Medium: { icon: Minus, className: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  Low: { icon: ArrowDown, className: "bg-muted text-muted-foreground" },
}

const order: Priority[] = ["High", "Medium", "Low"]

export default function CrmActions({ actions }: { actions: CrmAction[] }) {
  const sorted = [...actions].sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority))

  return (
    <section aria-labelledby="actions-title" className="flex flex-col gap-4">
      <div>
        <h2 id="actions-title" className="text-xl font-semibold tracking-tight">Recommended next steps</h2>
        <p className="text-sm text-muted-foreground">What to do next, based on this period&apos;s numbers.</p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {sorted.map((a) => {
          const { icon: Icon, className } = priorityStyle[a.priority]
          return (
            <li key={`${a.channel}-${a.segment}`} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", className)}>
                  <Icon className="size-3.5" aria-hidden="true" />
                  {a.priority} priority
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {a.channel}
                </span>
              </div>
              <p className="font-semibold leading-snug">{a.action}</p>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Who</dt>
                  <dd>{a.segment}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Why</dt>
                  <dd className="text-muted-foreground">{a.reason}</dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
