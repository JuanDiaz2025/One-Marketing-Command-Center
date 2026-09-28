import Link from "next/link"

import { formatDate, formatNumber, formatPercent, formatUsd } from "@/components/dashboard/format"
import { maskContact } from "@/lib/conversions/insights"
import type { DashboardData } from "@/lib/dashboard-data"
import { placement } from "@/lib/placements"

export default function CustomersSection({ data }: { data: DashboardData }) {
  const { totals, customers } = data
  const returning = customers.filter((c) => c.visits > 1).length
  const stages = [
    { label: "Impressions", value: totals.impressions },
    { label: "Clicks", value: totals.clicks },
    { label: "Conversions", value: totals.conversions },
    { label: "Came back", value: data.matched.filter((c) => !c.firstVisit).length },
  ]

  return (
    <section aria-labelledby="customers-title" className="flex flex-col gap-4">
      <div>
        <h2 id="customers-title" className="text-xl font-semibold tracking-tight">
          Customers
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatNumber(customers.length)} people converted in store, {formatNumber(returning)} of
          them more than once.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          <h3 className="font-semibold">From ad to counter</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Bars show how many moved on from the step before.
          </p>
          <ol className="mt-5 flex flex-col gap-3">
            {stages.map((s, i) => {
              const prev = stages[i - 1]
              const step = prev ? s.value / Math.max(prev.value, 1) : 1
              return (
                <li
                  key={s.label}
                  className="grid grid-cols-[6rem_4.5rem_minmax(0,1fr)] items-center gap-3 text-sm"
                >
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="text-right font-semibold tabular-nums">
                    {formatNumber(s.value)}
                  </span>
                  {prev ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `max(${step * 100}%, 4px)` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {formatPercent(step)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">starting point</span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">Recent customers</h3>
            <Link href="/conversions" className="text-sm text-primary underline underline-offset-4">
              Conversion feed
            </Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Brought in by
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Visits
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Spent
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Last visit
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.slice(0, 8).map((c) => (
                  <tr key={c.key} className="border-b last:border-0">
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                      {maskContact(c)}
                    </th>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {c.attribution ? placement(c.attribution.placementId).name : "Walk-in"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{c.visits}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatUsd(c.spend)}</td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      {formatDate(c.lastSeen.slice(0, 10))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
