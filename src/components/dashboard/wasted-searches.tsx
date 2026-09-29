import { Trash2 } from "lucide-react"

import CopyButton from "@/components/dashboard/copy-button"
import Paged from "@/components/ui/paged"
import { formatMoney, formatNumber } from "@/components/dashboard/format"
import { negativeKeywordList, type WastedSearch } from "@/lib/google/wasted-searches"

type Props = {
  wasted: WastedSearch[]
  total: number
  spendLimit: number
  currency: string
  // Set when Google Ads couldn't return search terms, so the rest of the dashboard still shows.
  error?: string
}

// Search terms that cost money without bringing in a lead, and the negative keywords to block them.
export default function WastedSearches({ wasted, total, spendLimit, currency, error }: Props) {
  const money = (n: number, cents = false) => formatMoney(n, currency, cents)
  const fresh = wasted.filter((w) => w.isNew).length

  return (
    <section id="wasted" className="scroll-mt-20 rounded-2xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Trash2 className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Searches to remove</h2>
            <p className="text-sm text-muted-foreground">
              {error
                ? "Search terms couldn't be loaded."
                : wasted.length
                  ? `${formatNumber(wasted.length)} searches cost ${money(total)} with no leads${fresh ? `, ${formatNumber(fresh)} new since yesterday` : ""}.`
                  : "No wasted searches found in this period."}
            </p>
          </div>
        </div>
        {wasted.length > 0 && (
          <CopyButton text={negativeKeywordList(wasted)} label="Copy negative keywords" />
        )}
      </div>

      {error && <p className="px-5 pt-3 text-sm text-destructive sm:px-6">{error}</p>}

      {wasted.length > 0 && (
        <div className="mt-4">
          <Paged
            noun="searches"
            table={{
              className: "w-full min-w-[720px] text-sm",
              bodyClassName: "divide-y tabular-nums",
              head: (
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-y">
                    <th className="px-5 py-3 font-medium sm:px-6">Search term</th>
                    <th className="px-3 py-3 font-medium">Why</th>
                    <th className="px-3 py-3 text-right font-medium">Spend</th>
                    <th className="px-3 py-3 text-right font-medium">Clicks</th>
                    <th className="px-5 py-3 font-medium sm:px-6">Block with</th>
                  </tr>
                </thead>
              ),
            }}
            items={wasted.map((w) => (
              <tr key={`${w.term}-${w.campaign}-${w.adGroup}`}>
                <td className="px-5 py-3 sm:px-6">
                  <p className="font-medium">
                    {w.term}
                    {w.isNew && (
                      <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 align-middle text-xs font-medium text-destructive">
                        New
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{w.campaign}</p>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{w.reason}</td>
                <td className="px-3 py-3 text-right">{money(w.cost, true)}</td>
                <td className="px-3 py-3 text-right">{formatNumber(w.clicks)}</td>
                <td className="px-5 py-3 font-mono text-xs sm:px-6">{w.negative}</td>
              </tr>
            ))}
          />
        </div>
      )}

      <div className="px-5 py-4 text-xs text-muted-foreground sm:px-6">
        {wasted.length > 10 && <p>Most expensive first. Copy includes all of them, not only this page.</p>}
        <p>
          Flagged when a search brought no leads and either matches a word like &ldquo;rent&rdquo; or
          &ldquo;jobs&rdquo;, or cost more than {money(spendLimit)}. Check the list first, then in
          Google Ads open <strong>Keywords → Negative keywords → +</strong>, paste, and save.
          Performance Max searches aren&apos;t included; Google doesn&apos;t report them here.
        </p>
      </div>
    </section>
  )
}
