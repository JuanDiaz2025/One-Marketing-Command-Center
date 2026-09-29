import { MapPin } from "lucide-react"

import { formatMoney, formatNumber } from "@/components/dashboard/format"
import Paged from "@/components/ui/paged"
import type { LocationReport } from "@/lib/google/locations"

type Props = {
  locations: LocationReport | { error: string }
  currency: string
}

const optionLabel: Record<string, string> = {
  PRESENCE: "People in these places",
  PRESENCE_OR_INTEREST: "People in, or searching about, these places",
  SEARCH_INTEREST: "People searching about these places",
}

// Where each campaign is aimed, and which places the clicks and spend came from.
export default function Locations({ locations, currency }: Props) {
  const money = (n: number, cents = false) => formatMoney(n, currency, cents)

  return (
    <section id="locations" className="scroll-mt-20 rounded-2xl border bg-card shadow-xs">
      <div className="flex items-start gap-3 px-5 pt-5 sm:px-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MapPin className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Locations</h2>
          <p className="text-sm text-muted-foreground">
            Where your campaigns are set to show, and where the people who saw and clicked your ads were.
          </p>
        </div>
      </div>

      {"error" in locations ? (
        <p className="px-5 py-4 text-sm text-destructive sm:px-6">{locations.error}</p>
      ) : (
        <>
          {locations.targets.length > 0 && (
            <div className="mt-4 border-t">
              <h3 className="px-5 pt-4 text-sm font-semibold sm:px-6">Targeting</h3>
              <Paged
                noun="campaigns"
                pageSize={5}
                listClassName="divide-y"
                items={locations.targets.map((t) => (
                  <li key={t.campaign} className="flex flex-col gap-1 px-5 py-3 text-sm sm:px-6">
                    <p className="font-medium">{t.campaign}</p>
                    <p>
                      <span className="text-muted-foreground">Shows in: </span>
                      {t.included.length ? (
                        t.included.join(" · ")
                      ) : (
                        <span className="font-medium text-destructive">Everywhere (no location set)</span>
                      )}
                    </p>
                    {t.excluded.length > 0 && (
                      <p>
                        <span className="text-muted-foreground">Excluded: </span>
                        {t.excluded.join(" · ")}
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      Reaches: {optionLabel[t.option] ?? t.option}
                      {t.option !== "PRESENCE" && (
                        <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Change to &ldquo;Presence&rdquo;
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              />
            </div>
          )}

          <div className="mt-2 border-t">
            <h3 className="px-5 pt-4 text-sm font-semibold sm:px-6">Where clicks came from</h3>
            {locations.places.length ? (
              <Paged
                noun="places"
                table={{
                  className: "mt-2 w-full min-w-[640px] text-sm",
                  bodyClassName: "divide-y tabular-nums",
                  head: (
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr className="border-y">
                        <th className="px-5 py-3 font-medium sm:px-6">Place</th>
                        <th className="px-3 py-3 text-right font-medium">Spend</th>
                        <th className="px-3 py-3 text-right font-medium">Impr.</th>
                        <th className="px-3 py-3 text-right font-medium">Clicks</th>
                        <th className="px-3 py-3 text-right font-medium">Conv.</th>
                        <th className="px-5 py-3 text-right font-medium sm:px-6">Cost / conv.</th>
                      </tr>
                    </thead>
                  ),
                }}
                items={locations.places.map((p) => (
                  <tr key={`${p.name}-${p.inTarget}`}>
                    <td className="px-5 py-3 sm:px-6">
                      <p className="font-medium">
                        {p.name}
                        {!p.inTarget && (
                          <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 align-middle text-xs font-medium text-destructive">
                            Outside target
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right">{money(p.cost, true)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(p.impressions)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(p.clicks)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(Math.round(p.conversions * 10) / 10)}</td>
                    <td className="px-5 py-3 text-right sm:px-6">
                      {p.conversions ? money(p.cost / p.conversions, true) : "–"}
                    </td>
                  </tr>
                ))}
              />
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground sm:px-6">No location data in this period.</p>
            )}
          </div>
        </>
      )}
      <p className="px-5 py-4 text-xs text-muted-foreground sm:px-6">
        Places are where people physically were, down to the city when Google knows it. Change targeting
        in Google Ads under the campaign&apos;s <strong>Settings → Locations</strong>.
      </p>
    </section>
  )
}
