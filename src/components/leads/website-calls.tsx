import { MousePointerClick, Smartphone } from "lucide-react"

import CallLeadButton from "@/components/leads/call-lead-button"
import Paged from "@/components/ui/paged"
import { formatPhone, type CallTap } from "@/lib/leads/call-taps"
import { googleClick, leadChannel, pagePath } from "@/lib/leads/tracking"
import type { Lead } from "@/lib/leads/types"

type Props = {
  // The last 30 days, newest first.
  taps: CallTap[]
  // Taps already added as leads: their motivation score, or null when added without one.
  added: Record<number, { value: number; grade: "hot" | "warm" | "cold" | "junk" } | null>
  // The site's plugin notes taps (1.5+); older ones don't.
  supported: boolean
}

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

// Where the caller came from, in a few words: "Google Ads · Sell House Fast · we buy houses".
function cameFrom(t: CallTap["tracking"]) {
  const channel = leadChannel({ tracking: t } as Lead)
  const ad = googleClick(t) ? "Google Ads" : channel
  return [ad === "Unknown" ? "Came straight to the site" : ad, t?.utmCampaign, t?.utmTerm].filter(Boolean).join(" · ")
}

// Calls started from the website: someone tapped one of its phone numbers. The app can't hear the
// call, but it knows which ad or search brought them; add the call as a lead after talking to them.
export default function WebsiteCalls({ taps, added, supported }: Props) {
  const recent = taps
  const numbers = [...new Set(recent.map((t) => formatPhone(t.number)))]
  return (
    <section id="website-calls" className="scroll-mt-20 rounded-2xl border bg-card shadow-xs">
      <div className="flex items-start gap-3 px-5 pt-5 sm:px-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MousePointerClick className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Calls from your website</h2>
          <p className="text-sm text-muted-foreground">
            {supported
              ? recent.length
                ? `${recent.length} tap${recent.length === 1 ? "" : "s"} on your phone number${numbers.length === 1 ? ` ${numbers[0]}` : "s"} in the last 30 days, with the ad or search that brought each caller. After the call, add it as a lead: Google Ads then learns which clicks bring sellers who call.`
                : "Nobody has tapped a phone number on your site in the last 30 days. Each tap shows up here within seconds, with the ad or search that brought them."
              : "Update the Lead Saver plugin on your site (Website leads, below) to see who taps your phone number on the site, and which ad brought them."}
          </p>
        </div>
      </div>
      {recent.length > 0 && (
        <div className="mt-4">
          <Paged
            noun="calls"
            table={{
              className: "w-full min-w-[760px] text-sm",
              bodyClassName: "divide-y",
              head: (
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-y">
                    <th className="px-5 py-3 font-medium sm:px-6">When</th>
                    <th className="px-3 py-3 font-medium">Number tapped</th>
                    <th className="px-3 py-3 font-medium">Came from</th>
                    <th className="px-3 py-3 font-medium">Page</th>
                    <th className="px-5 py-3 font-medium sm:px-6"></th>
                  </tr>
                </thead>
              ),
            }}
            items={recent.map((t) => (
              <tr key={t.id} className="align-top">
                <td className="px-5 py-3 whitespace-nowrap sm:px-6">
                  {when(t.at)}
                  {t.mobile && <Smartphone className="ml-1.5 inline size-3.5 text-muted-foreground" aria-label="On a phone" />}
                </td>
                <td className="px-3 py-3 whitespace-nowrap tabular-nums">{formatPhone(t.number)}</td>
                <td className="px-3 py-3">{cameFrom(t.tracking)}</td>
                <td className="px-3 py-3 text-muted-foreground">{pagePath(t.page)}</td>
                <td className="px-5 py-3 sm:px-6">
                  <CallLeadButton tapId={t.id} added={t.id in added ? added[t.id] : false} />
                </td>
              </tr>
            ))}
          />
        </div>
      )}
      <div className="h-5" />
    </section>
  )
}
