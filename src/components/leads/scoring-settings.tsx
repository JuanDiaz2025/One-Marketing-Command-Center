"use client"

import { useState, useTransition } from "react"
import { Gauge } from "lucide-react"

import { setAutoStatusAction } from "@/lib/leads/scoring-actions"
import { cn } from "@/lib/utils"

// Automatic lead scoring: what it does, how points are given, and the switch for setting the
// status from the score.
export default function ScoringSettings({ autoStatus }: { autoStatus: boolean }) {
  const [on, setOn] = useState(autoStatus)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Gauge className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Automatic lead scoring</p>
          <p className="text-muted-foreground">
            Every lead gets a score from 0 to 100 the moment it arrives: <strong className="text-red-700">Hot</strong> (70+ and a sign
            they want to sell: a seller search or their own words),{" "}
            <strong className="text-amber-700">Warm</strong> (40 to 69), <strong className="text-sky-800">Cold</strong> or{" "}
            <strong>Junk</strong> (tests, fake numbers, spam). Click <strong>why?</strong> in the Score column to see how it was scored.
          </p>
        </div>
        <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2", pending && "opacity-60")}>
          <input
            type="checkbox"
            role="switch"
            checked={on}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.checked
              setOn(next)
              setError(null)
              start(async () => {
                const res = await setAutoStatusAction(next)
                if (res.error) {
                  setOn(!next)
                  setError(res.error)
                }
              })
            }}
            className="size-5 accent-[var(--primary)]"
          />
          <span className="font-medium">Set the status from the score</span>
        </label>
      </div>
      <p className={cn("rounded-lg p-3", on ? "bg-emerald-500/10 text-emerald-900" : "bg-card text-muted-foreground")}>
        {on ? (
          <>
            <strong>On.</strong> New Hot leads are marked <strong>Interested</strong> right away, which tells Google Ads they were good
            leads, and Junk is marked <strong>Not interested</strong>. Google Ads recommends sending back only qualified leads like
            this, so its bidding finds more real sellers instead of more form-fillers. Change any status yourself and yours stays.
          </>
        ) : (
          <>
            <strong>Off.</strong> Leads are still scored, but you set every status yourself.
          </>
        )}
      </p>
      <details>
        <summary className="cursor-pointer font-medium">How the points add up</summary>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-muted-foreground sm:grid-cols-2">
          <li>+25 a real phone number</li>
          <li>+20 a property address with a house number</li>
          <li>+15 a motivated seller (inherited, foreclosure, repairs, divorce, tenants, vacant…)</li>
          <li>+10 an email address</li>
          <li>+10 came from a paid ad click</li>
          <li>+10 searched like a seller (&ldquo;sell my house fast&rdquo;, &ldquo;cash offer&rdquo;…)</li>
          <li>+5 a full name</li>
          <li>+5 came back: sent a form before</li>
          <li>−15 a phone number that looks fake or incomplete</li>
          <li>−25 blocked as spam on the website (often reCAPTCHA; may be a real person)</li>
          <li>−30 a message with links, other than Zillow, Redfin, Realtor.com or map links (often spam)</li>
          <li>Junk: a test or fake name, an advert, or no real phone or email</li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          Only leads that arrived in the last 24 hours get a status from their score. Older leads (from before scoring, or brought in
          late from the website) are scored too, but their status is left for you, so nothing old is sent to Google Ads without you.
          A lead whose form fields weren&apos;t recognized is never given a status automatically.
        </p>
      </details>
      {error && <p className="text-destructive">{error}</p>}
    </div>
  )
}
