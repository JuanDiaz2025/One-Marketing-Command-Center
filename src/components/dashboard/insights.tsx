import { formatNumber, formatPercent } from "@/components/dashboard/format"
import Paged from "@/components/ui/paged"
import type { Ad, ConversionAction, DeviceRow, Insights, Keyword, TimeRow } from "@/lib/google/insights"
import { cn } from "@/lib/utils"

type Money = (n: number, cents?: boolean) => string

const card = "rounded-2xl border bg-card shadow-xs"
const th = "px-3 py-3 text-left text-xs font-medium text-muted-foreground first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6"
const thR = `${th} text-right`
const td = "px-3 py-3 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6"
const tdR = `${td} text-right`
const badge = (tone: "bad" | "warn" | "good" | "muted", text: string) => (
  <span
    className={cn(
      "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
      tone === "bad" && "bg-destructive/10 text-destructive",
      tone === "warn" && "bg-amber-500/15 text-amber-800",
      tone === "good" && "bg-emerald-500/10 text-emerald-700",
      tone === "muted" && "bg-muted text-muted-foreground",
    )}
  >
    {text}
  </span>
)

function Header({ title, note }: { title: string; note: string }) {
  return (
    <div className="px-5 pt-5 sm:px-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  )
}

function Failed({ error }: { error: string }) {
  return <p className="px-5 py-4 text-sm text-destructive sm:px-6">{error}</p>
}

const perConv = (m: { cost: number; conversions: number }, money: Money) =>
  m.conversions ? money(m.cost / m.conversions, true) : "–"
const ctr = (m: { clicks: number; impressions: number }) => formatPercent(m.impressions ? m.clicks / m.impressions : 0)
const conv = (n: number) => formatNumber(Math.round(n * 10) / 10)
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")

// Keyword problems worth a count on the tab: poor Quality Score, or a lead's worth spent with no lead.
export function keywordProblems(rows: Keyword[], costPerLead: number) {
  const limit = Math.max(25, costPerLead)
  return rows.filter((k) => (k.qualityScore !== null && k.qualityScore <= 4) || (k.conversions < 0.5 && k.cost >= limit)).length
}

export function KeywordsPanel({ part, money, costPerLead }: { part: Insights["keywords"]; money: Money; costPerLead: number }) {
  const limit = Math.max(25, costPerLead)
  return (
    <section className={card}>
      <Header
        title="Keywords"
        note={`What each keyword cost and brought in. Red: Quality Score 4 or lower, or ${money(limit)}+ spent with no lead.`}
      />
      {"error" in part ? (
        <Failed error={part.error} />
      ) : part.rows.length ? (
        <div className="mt-4">
          <Paged
            noun="keywords"
            table={{
              className: "w-full min-w-[860px] text-sm",
              bodyClassName: "divide-y tabular-nums",
              head: (
                <thead>
                  <tr className="border-y">
                    <th className={th}>Keyword</th>
                    <th className={th}>Match</th>
                    <th className={thR}>Quality</th>
                    <th className={thR}>Spend</th>
                    <th className={thR}>Clicks</th>
                    <th className={thR}>Click rate</th>
                    <th className={thR}>Avg. cost / click</th>
                    <th className={thR}>Conv.</th>
                    <th className={thR}>Cost / conv.</th>
                  </tr>
                </thead>
              ),
            }}
            items={part.rows.map((k, i) => {
              const poorQs = k.qualityScore !== null && k.qualityScore <= 4
              const noLeads = k.conversions < 0.5 && k.cost >= limit
              return (
                <tr key={`${k.text}-${k.adGroup}-${k.matchType}-${i}`} className={poorQs || noLeads ? "bg-destructive/5" : undefined}>
                  <td className={td}>
                    <p className="font-medium">
                      {k.text} {noLeads && badge("bad", "No leads")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {k.campaign} · {k.adGroup}
                      {k.status === "PAUSED" ? " · paused" : ""}
                    </p>
                  </td>
                  <td className={td}>{title(k.matchType)}</td>
                  <td className={tdR}>
                    {k.qualityScore === null ? "–" : badge(poorQs ? "bad" : k.qualityScore >= 7 ? "good" : "warn", `${k.qualityScore}/10`)}
                  </td>
                  <td className={tdR}>{money(k.cost, true)}</td>
                  <td className={tdR}>{formatNumber(k.clicks)}</td>
                  <td className={tdR}>{ctr(k)}</td>
                  <td className={tdR}>{k.clicks ? money(k.cost / k.clicks, true) : "–"}</td>
                  <td className={tdR}>{conv(k.conversions)}</td>
                  <td className={tdR}>{perConv(k, money)}</td>
                </tr>
              )
            })}
          />
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground sm:px-6">No keyword activity in this period.</p>
      )}
      <p className="px-5 py-4 text-xs text-muted-foreground sm:px-6">
        Quality Score is Google&apos;s 1–10 grade for how well the keyword, ad and landing page match. Low scores pay more per
        click. Performance Max campaigns don&apos;t use keywords, so they aren&apos;t listed.
      </p>
    </section>
  )
}

const adProblem = (a: Ad) => a.approval === "DISAPPROVED" || a.approval === "APPROVED_LIMITED" || a.strength === "POOR"

export const adProblems = (rows: Ad[]) => rows.filter((a) => a.status === "ENABLED" && adProblem(a)).length

export function AdsPanel({ part, money }: { part: Insights["ads"]; money: Money }) {
  const strengthTone = (s: string) => (s === "POOR" ? "bad" : s === "AVERAGE" ? "warn" : s === "GOOD" || s === "EXCELLENT" ? "good" : "muted")
  return (
    <section className={card}>
      <Header title="Ads" note="Your ads, most seen first. Red: disapproved, limited, or Ad Strength “Poor”." />
      {"error" in part ? (
        <Failed error={part.error} />
      ) : part.rows.length ? (
        <div className="mt-4">
          <Paged
            noun="ads"
            table={{
              className: "w-full min-w-[900px] text-sm",
              bodyClassName: "divide-y tabular-nums",
              head: (
                <thead>
                  <tr className="border-y">
                    <th className={th}>Ad (first headlines)</th>
                    <th className={th}>Status</th>
                    <th className={th}>Ad Strength</th>
                    <th className={thR}>Impr.</th>
                    <th className={thR}>Clicks</th>
                    <th className={thR}>Click rate</th>
                    <th className={thR}>Conv.</th>
                    <th className={thR}>Cost / conv.</th>
                  </tr>
                </thead>
              ),
            }}
            items={part.rows.map((a) => (
              <tr key={a.id} className={a.status === "ENABLED" && adProblem(a) ? "bg-destructive/5" : undefined}>
                <td className={`${td} max-w-md`}>
                  <p className="font-medium">{a.headlines.slice(0, 3).join(" | ") || "Ad without headlines (image or video ad)"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.campaign} · {a.adGroup}
                    {a.finalUrl ? ` · ${a.finalUrl.replace(/^https?:\/\/(www\.)?/, "")}` : ""}
                  </p>
                </td>
                <td className={td}>
                  {a.approval === "DISAPPROVED"
                    ? badge("bad", "Disapproved")
                    : a.approval === "APPROVED_LIMITED"
                      ? badge("warn", "Limited")
                      : a.status === "PAUSED"
                        ? badge("muted", "Paused")
                        : badge("good", "Running")}
                </td>
                <td className={td}>{a.strength && a.strength !== "UNSPECIFIED" && a.strength !== "UNKNOWN" ? badge(strengthTone(a.strength), title(a.strength)) : "–"}</td>
                <td className={tdR}>{formatNumber(a.impressions)}</td>
                <td className={tdR}>{formatNumber(a.clicks)}</td>
                <td className={tdR}>{ctr(a)}</td>
                <td className={tdR}>{conv(a.conversions)}</td>
                <td className={tdR}>{perConv(a, money)}</td>
              </tr>
            ))}
          />
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground sm:px-6">No ad activity in this period.</p>
      )}
      <p className="px-5 py-4 text-xs text-muted-foreground sm:px-6">
        To raise Ad Strength, open the ad in Google Ads and add more distinct headlines (up to 15) with your keywords, like
        &ldquo;Sell Your House Fast&rdquo; and &ldquo;Cash Offer in 24 Hours&rdquo;.
      </p>
    </section>
  )
}

const deviceName: Record<string, string> = {
  MOBILE: "Phones",
  DESKTOP: "Computers",
  TABLET: "Tablets",
  CONNECTED_TV: "TV screens",
  OTHER: "Other",
}

function Bar({ value, max, tone = "primary" }: { value: number; max: number; tone?: "primary" | "good" }) {
  return (
    <div className="h-2 w-full min-w-16 rounded-full bg-muted">
      <div
        className={cn("h-2 rounded-full", tone === "good" ? "bg-emerald-500" : "bg-primary")}
        style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }}
      />
    </div>
  )
}

export function DevicesPanel({ part, money }: { part: Insights["devices"]; money: Money }) {
  const rows = "rows" in part ? [...part.rows].sort((a, b) => b.cost - a.cost) : []
  const total = rows.reduce((s, r) => s + r.cost, 0)
  const withConv = rows.filter((r) => r.conversions >= 1)
  const best = withConv.length ? withConv.reduce((a, b) => (a.cost / a.conversions <= b.cost / b.conversions ? a : b)) : null
  const worst = rows.find((r) => r.cost >= Math.max(25, total * 0.1) && r.conversions < 0.5)
  return (
    <section className={card}>
      <Header title="Devices" note="Where people saw and clicked your ads: phones, computers or tablets." />
      {"error" in part ? (
        <Failed error={part.error} />
      ) : rows.length ? (
        <>
          {(best || worst) && (
            <div className="flex flex-col gap-2 px-5 pt-4 text-sm sm:px-6">
              {best && (
                <p className="rounded-xl bg-emerald-500/10 p-3 text-emerald-900">
                  <strong>{deviceName[best.device] ?? title(best.device)}</strong> bring leads cheapest, at{" "}
                  {money(best.cost / best.conversions, true)} each.
                </p>
              )}
              {worst && (
                <p className="rounded-xl bg-destructive/10 p-3 text-destructive">
                  <strong>{deviceName[worst.device] ?? title(worst.device)}</strong> spent {money(worst.cost, true)} with no
                  leads. Consider a lower bid for them: in Google Ads open the campaign → Devices, and set a bid adjustment
                  (for example −40%).
                </p>
              )}
            </div>
          )}
          <DataTable
            head={["Device", "Share of spend", "Spend", "Clicks", "Click rate", "Conv.", "Cost / conv."]}
            rows={rows.map((r: DeviceRow) => [
              <span key="n" className="font-medium">{deviceName[r.device] ?? title(r.device)}</span>,
              <div key="b" className="flex items-center gap-2">
                <Bar value={r.cost} max={total} />
                <span className="text-xs text-muted-foreground">{formatPercent(total ? r.cost / total : 0, 0)}</span>
              </div>,
              money(r.cost, true),
              formatNumber(r.clicks),
              ctr(r),
              conv(r.conversions),
              perConv(r, money),
            ])}
          />
        </>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground sm:px-6">No device data in this period.</p>
      )}
    </section>
  )
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`

function sum(rows: TimeRow[]) {
  return rows.reduce(
    (m, r) => ({ cost: m.cost + r.cost, clicks: m.clicks + r.clicks, impressions: m.impressions + r.impressions, conversions: m.conversions + r.conversions }),
    { cost: 0, clicks: 0, impressions: 0, conversions: 0 },
  )
}

export function TimingPanel({ part, money }: { part: Insights["times"]; money: Money }) {
  const rows = "rows" in part ? part.rows : []
  const days = DAYS.map((d) => ({ label: title(d), ...sum(rows.filter((r) => r.day === d)) }))
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: hourLabel(h), ...sum(rows.filter((r) => r.hour === h)) }))
  const maxDay = Math.max(0, ...days.map((d) => d.conversions))
  const maxHour = Math.max(0, ...hours.map((d) => d.conversions))
  const maxDayCost = Math.max(0, ...days.map((d) => d.cost))
  const maxHourCost = Math.max(0, ...hours.map((d) => d.cost))
  const bestDay = days.reduce((a, b) => (b.conversions > a.conversions ? b : a), days[0])
  const bestHours = [...hours].sort((a, b) => b.conversions - a.conversions).filter((h) => h.conversions > 0).slice(0, 3)
  const deadHours = hours.filter((h) => h.cost >= 10 && h.conversions < 0.5)

  const table = (list: typeof days, maxConv: number, maxCost: number, first: string) => (
    <DataTable
      head={[first, "Leads", "Spend", "Clicks", "Conv.", "Cost / conv."]}
      rows={list.map((d) => [
        <span key="n" className="font-medium">{d.label}</span>,
        <Bar key="c" value={d.conversions} max={maxConv} tone="good" />,
        <div key="s" className="flex items-center justify-end gap-2">
          <span className="w-20">
            <Bar value={d.cost} max={maxCost} />
          </span>
          {money(d.cost, true)}
        </div>,
        formatNumber(d.clicks),
        conv(d.conversions),
        perConv(d, money),
      ])}
    />
  )

  return (
    <section className={card}>
      <Header title="Best days and times" note="When your ads bring leads, by day of the week and hour (the account's time zone)." />
      {"error" in part ? (
        <Failed error={part.error} />
      ) : rows.length ? (
        <>
          <div className="flex flex-col gap-2 px-5 pt-4 text-sm sm:px-6">
            {bestDay?.conversions > 0 && (
              <p className="rounded-xl bg-emerald-500/10 p-3 text-emerald-900">
                Most leads come on <strong>{bestDay.label}</strong>
                {bestHours.length ? (
                  <>
                    , and around <strong>{bestHours.map((h) => h.label).join(", ")}</strong>
                  </>
                ) : null}
                .
              </p>
            )}
            {deadHours.length > 0 && (
              <p className="rounded-xl bg-amber-500/10 p-3 text-amber-900">
                {deadHours.length} hour{deadHours.length === 1 ? "" : "s"} of the day spent money with no leads (
                {deadHours.slice(0, 4).map((h) => h.label).join(", ")}
                {deadHours.length > 4 ? "…" : ""}). An ad schedule can lower bids then: in Google Ads open the campaign →
                Ad schedule.
              </p>
            )}
          </div>
          <h3 className="px-5 pt-4 text-sm font-semibold sm:px-6">By day of the week</h3>
          {table(days, maxDay, maxDayCost, "Day")}
          <h3 className="px-5 pt-4 text-sm font-semibold sm:px-6">By hour</h3>
          {table(
            hours.filter((h) => h.impressions > 0 || h.cost > 0),
            maxHour,
            maxHourCost,
            "Hour",
          )}
        </>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground sm:px-6">No data in this period.</p>
      )}
      <div className="h-4" />
    </section>
  )
}

// A conversion action is how Google counts a lead (a form sent, a call). Problems: none at all,
// or one that's active but recorded nothing.
export function conversionProblems(rows: ConversionAction[]) {
  const enabled = rows.filter((r) => r.status === "ENABLED")
  if (!enabled.length) return 1
  return enabled.filter((r) => r.primary && r.conversions === 0).length
}

export function ConversionsPanel({ part }: { part: Insights["conversions"] }) {
  const rows = "rows" in part ? [...part.rows].sort((a, b) => b.conversions - a.conversions) : []
  const enabled = rows.filter((r) => r.status === "ENABLED")
  return (
    <section className={card}>
      <Header
        title="Conversion tracking"
        note="What Google Ads counts as a lead. If this is wrong, Google optimizes for the wrong thing."
      />
      {"error" in part ? (
        <Failed error={part.error} />
      ) : (
        <>
          {!enabled.length && (
            <p className="mx-5 mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive sm:mx-6">
              <strong>No active conversion tracking.</strong> Google can&apos;t tell which clicks became leads. In Google Ads
              open <strong>Goals → Conversions → New conversion action</strong> and add &ldquo;Website&rdquo; (form
              submissions) and &ldquo;Phone calls&rdquo;.
            </p>
          )}
          {rows.length > 0 && (
            <DataTable
              head={["Conversion action", "Counts as", "Status", "Main goal", "Recorded in period"]}
              rows={rows.map((r) => [
                <span key="n" className="font-medium">{r.name}</span>,
                title(r.category || "Other"),
                r.status === "ENABLED" ? badge("good", "Active") : badge("muted", title(r.status)),
                r.primary ? "Yes" : "No (secondary)",
                r.status === "ENABLED" && r.primary && r.conversions === 0 ? badge("bad", "0 — check it") : conv(r.conversions),
              ])}
            />
          )}
          <p className="px-5 py-4 text-xs text-muted-foreground sm:px-6">
            An active main goal that records 0 usually means the tag isn&apos;t on the thank-you page, or the form changed. In
            Google Ads open Goals → Conversions → Summary and check its status says &ldquo;Recording conversions&rdquo;.
          </p>
        </>
      )}
    </section>
  )
}

// A plain table with the dashboard's look; numbers right-aligned after the first two columns.
function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm tabular-nums">
        <thead>
          <tr className="border-y">
            {head.map((h, i) => (
              <th key={h} className={i < 2 ? th : thR}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((cells, r) => (
            <tr key={r}>
              {cells.map((c, i) => (
                <td key={i} className={i < 2 ? td : tdR}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
