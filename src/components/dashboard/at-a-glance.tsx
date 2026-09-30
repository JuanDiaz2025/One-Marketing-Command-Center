import { ArrowDown, ArrowRight, ArrowUp, CircleCheck } from "lucide-react"

import { formatMoney, formatNumber, formatPercent } from "@/components/dashboard/format"
import type { AdsReport } from "@/lib/google/ads"
import type { Issue } from "@/lib/google/health"
import { cn } from "@/lib/utils"

type Props = {
  report: AdsReport
  // The same number of days just before, to say whether things got better; null for all time.
  previous: AdsReport | null
  issues: Issue[]
  wastedTotal: number
  calls: { total: number; missed: number } | null
  periodLabel: string // "in the last 30 days", "since the account started"
}

// A grade for the account: every serious problem costs 15 points, every smaller one 5.
function grade(issues: Issue[]) {
  const score = Math.max(0, 100 - issues.reduce((s, i) => s + (i.severity === "high" ? 15 : 5), 0))
  const letter = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F"
  const words = { A: "Healthy", B: "Mostly fine", C: "Needs work", D: "Losing money", F: "Urgent fixes needed" }[letter]
  const tone = letter === "A" || letter === "B" ? "good" : letter === "C" ? "warn" : "bad"
  return { score, letter, words, tone }
}

// Percent change, or null when there's nothing to compare with.
const change = (now: number, before: number | undefined) => (before ? (now - before) / before : null)

function Delta({ value, goodWhenUp, label }: { value: number | null; goodWhenUp: boolean; label: string }) {
  if (value === null || !Number.isFinite(value)) return <p className="mt-1 text-xs text-muted-foreground">{label}</p>
  const flat = Math.abs(value) < 0.02
  const good = flat ? null : value > 0 === goodWhenUp
  const Icon = flat ? ArrowRight : value > 0 ? ArrowUp : ArrowDown
  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-1 text-xs font-medium",
        good === null ? "text-muted-foreground" : good ? "text-emerald-700" : "text-destructive",
      )}
    >
      <Icon className="size-3.5" />
      {flat ? "About the same as before" : `${formatPercent(Math.abs(value), 0)} ${value > 0 ? "more" : "less"} than before`}
    </p>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim()

// The top of the dashboard in plain English: what happened, better or worse than before, the
// account's grade, and the three things to do today.
export default function AtAGlance({ report, previous, issues, wastedTotal, calls, periodLabel }: Props) {
  const { totals, account } = report
  const money = (n: number, cents = false) => formatMoney(n, account.currency, cents)
  const cpl = totals.conversions ? totals.cost / totals.conversions : 0
  const prev = previous?.totals
  const prevCpl = prev?.conversions ? prev.cost / prev.conversions : undefined
  const g = grade(issues)

  const withLeads = report.campaigns.filter((c) => c.conversions >= 1)
  const best = withLeads.length ? withLeads.reduce((a, b) => (a.cost / a.conversions <= b.cost / b.conversions ? a : b)) : null
  const leak = report.campaigns.filter((c) => c.cost > 0 && c.conversions < 0.5).sort((a, b) => b.cost - a.cost)[0]

  const leadsChange = change(totals.conversions, prev?.conversions)
  const cplChange = cpl && prevCpl ? (cpl - prevCpl) / prevCpl : null

  // One sentence on how it's going.
  const story = !totals.cost
    ? `Your ads didn't spend anything ${periodLabel}.`
    : totals.conversions
      ? `${cap(periodLabel)} you spent ${money(totals.cost)} and got ${formatNumber(Math.round(totals.conversions * 10) / 10)} lead${totals.conversions === 1 ? "" : "s"} from Google Ads, at ${money(cpl, true)} each.`
      : `${cap(periodLabel)} you spent ${money(totals.cost)} but Google Ads recorded no leads. Either the ads aren't working or conversion tracking is broken; check the Conversion tracking tab.`
  const trend =
    leadsChange === null || !totals.conversions
      ? null
      : Math.abs(leadsChange) < 0.02
        ? "About the same number of leads as the period before."
        : `${formatPercent(Math.abs(leadsChange), 0)} ${leadsChange > 0 ? "more" : "fewer"} leads than the period before${
            cplChange !== null && Math.abs(cplChange) >= 0.02
              ? `, and each one cost ${formatPercent(Math.abs(cplChange), 0)} ${cplChange < 0 ? "less" : "more"}`
              : ""
          }.`

  const cards = [
    { label: "Spent", value: money(totals.cost), delta: <Delta value={change(totals.cost, prev?.cost)} goodWhenUp label={`${formatNumber(totals.clicks)} clicks`} /> },
    {
      label: "Leads from ads",
      value: formatNumber(Math.round(totals.conversions * 10) / 10),
      delta: <Delta value={leadsChange} goodWhenUp label="Form fills and calls Google counted" />,
    },
    {
      label: "Cost per lead",
      value: cpl ? money(cpl, true) : "–",
      delta: <Delta value={cplChange} goodWhenUp={false} label="Lower is better" />,
    },
    {
      label: "Calls from ads",
      value: calls ? formatNumber(calls.total) : "–",
      delta: calls?.missed ? (
        <p className="mt-1 text-xs font-medium text-destructive">{calls.missed} missed</p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{calls ? "None missed" : "Turn on call reporting to see calls"}</p>
      ),
    },
  ]

  const todo = [...issues.filter((i) => i.severity === "high"), ...issues.filter((i) => i.severity !== "high")].slice(0, 3)

  return (
    <section aria-label="Your ads at a glance" className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div
          className={cn(
            "flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl border-2",
            g.tone === "good" && "border-emerald-500/50 bg-emerald-500/10 text-emerald-700",
            g.tone === "warn" && "border-amber-500/50 bg-amber-500/10 text-amber-700",
            g.tone === "bad" && "border-destructive/50 bg-destructive/10 text-destructive",
          )}
          title={`Health score ${g.score} out of 100`}
        >
          <span className="text-4xl leading-none font-bold">{g.letter}</span>
          <span className="mt-1 text-[10px] font-semibold tracking-wide uppercase">Grade</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-semibold">
            Your ads at a glance: <span className={cn(g.tone === "good" ? "text-emerald-700" : g.tone === "warn" ? "text-amber-700" : "text-destructive")}>{g.words}</span>
          </h2>
          <p>{story}</p>
          {trend && <p className="text-muted-foreground">{trend}</p>}
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
            {best && (
              <li>
                <span className="font-medium text-emerald-700">Best campaign:</span> {best.name}, {money(best.cost / best.conversions, true)} per lead.
              </li>
            )}
            {leak && (
              <li>
                <span className="font-medium text-destructive">Biggest money leak:</span> {leak.name} spent {money(leak.cost)} with no leads.
              </li>
            )}
            {wastedTotal > 0 && (
              <li>
                <span className="font-medium text-destructive">Wasted searches:</span> {money(wastedTotal)} on searches from renters, buyers and job
                seekers (see Searches to remove).
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-5 shadow-xs">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{c.value}</p>
            {c.delta}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <h2 className="text-lg font-semibold">Do these today</h2>
        {todo.length ? (
          <ol className="mt-3 flex flex-col gap-3">
            {todo.map((i, n) => (
              <li key={i.id} className="flex gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                    i.severity === "high" ? "bg-destructive" : "bg-amber-500",
                  )}
                >
                  {n + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{i.title}</p>
                  <p className="text-sm text-muted-foreground">{firstSentence(i.fix)}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-emerald-700">
            <CircleCheck className="size-5" /> Nothing urgent. Check back tomorrow.
          </p>
        )}
        {issues.length > todo.length && (
          <a href="#health" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            See all {issues.length} problems and how to fix them →
          </a>
        )}
      </div>

      <details className="rounded-2xl border bg-card p-5 text-sm shadow-xs sm:px-6">
        <summary className="cursor-pointer font-medium">What do these words mean?</summary>
        <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {[
            ["Impression", "Your ad was shown once to someone searching."],
            ["Click", "Someone clicked your ad and went to your website."],
            ["Click rate (CTR)", "Clicks divided by impressions. Higher means the ad matches what people search for."],
            ["Lead / conversion", "Someone filled in your form or called after clicking an ad, as Google counted it."],
            ["Cost per lead", "What you spent divided by leads. The number to bring down."],
            ["Search term", "The exact words someone typed before seeing your ad."],
            ["Negative keyword", "A word you block so your ads don't show for it, like “rent”."],
            ["Quality Score", "Google's 1–10 grade for how well a keyword, ad and landing page match. Low scores pay more per click."],
            ["Impression share", "How often your ads showed out of the times they could have. The rest was lost to budget or to competitors' bids."],
            ["Ad Strength", "Google's grade for an ad's headlines and descriptions: Poor, Average, Good or Excellent."],
          ].map(([term, meaning]) => (
            <div key={term}>
              <dt className="font-medium">{term}</dt>
              <dd className="text-muted-foreground">{meaning}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  )
}
