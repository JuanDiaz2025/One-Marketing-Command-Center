import { Check, Store } from "lucide-react"

import FormatPreview from "@/components/format-preview"
import { formatPrice } from "@/components/dashboard/format"
import { maskContact, timeAgo } from "@/lib/conversions/insights"
import type { Conversion, QrCode } from "@/lib/conversions/types"
import { campaignAd, demoCampaign } from "@/lib/demo-campaign"
import { placement } from "@/lib/placements"

const matchedByLabel = { email: "email", phone: "phone number", cookie: "cookie" }

// The latest conversions, each with its order, the ad it was matched to, and where it was sent.
export default function ConversionList({
  conversions,
  qrCodes,
}: {
  conversions: Conversion[]
  qrCodes: QrCode[]
}) {
  const codeNames = new Map(qrCodes.map((c) => [c.id, c.placement]))
  return (
    <ul className="flex flex-col divide-y">
      {conversions.map((c) => {
        const where = c.attribution ? placement(c.attribution.placementId) : null
        const ad = campaignAd(c.attribution?.adId)
        return (
          <li key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{maskContact(c)}</span>
                {c.firstVisit ? (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    New customer
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Returning
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {timeAgo(c.createdAt)} · {codeNames.get(c.qrCodeId) ?? "QR code"}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {c.items.map((i) => i.name).join(", ")} ·{" "}
                <span className="font-medium text-foreground">{formatPrice(c.total)}</span>
                {c.discount > 0 && ` (saved ${formatPrice(c.discount)})`}
              </p>
            </div>

            <div className="flex min-w-0 items-center gap-3 sm:w-72">
              {where ? (
                <>
                  <FormatPreview
                    format={where.format}
                    image={ad?.image ?? demoCampaign.ads[0]?.image}
                    size="sm"
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{where.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {ad ? `“${ad.headline}”` : where.formatLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Matched by {matchedByLabel[c.attribution!.matchedBy]}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Store className="size-4" />
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Walk-in, not matched to an ad
                  </span>
                </>
              )}
            </div>

            <div className="flex gap-1.5 sm:w-40 sm:justify-end">
              {c.sentTo.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  <Check className="size-3" />
                  {p === "meta" ? "Meta" : "Google"}
                </span>
              ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
