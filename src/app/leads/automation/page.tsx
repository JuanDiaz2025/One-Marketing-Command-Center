import type { Metadata } from "next"

import AppHeader from "@/components/app-header"
import ConversionTargets from "@/components/leads/conversion-targets"
import RulesEditor from "@/components/leads/rules-editor"
import ScoringSettings from "@/components/leads/scoring-settings"
import SendingCheck from "@/components/leads/sending-check"
import { requireSession } from "@/lib/auth/session"
import { loadTargets, recentLeads } from "@/lib/leads/automation-data"
import { getRules } from "@/lib/leads/rules-store"
import { getScoringSettings } from "@/lib/leads/scoring"
import { listLeads } from "@/lib/leads/store"
import { leadChannel } from "@/lib/leads/tracking"

export const metadata: Metadata = { title: "Automation · One Marketing Command Center" }

// The automation behind the Leads page (scoring, Google Ads rules, where conversions go), kept on
// its own page so the Leads page stays clean. It isn't linked from the app: open
// http://localhost:4000/leads/automation to change it. Everything here runs whether it's open or not.
export default async function AutomationPage() {
  const user = await requireSession("/leads/automation")
  const [leads, scoring, rules, targets] = await Promise.all([listLeads(), getScoringSettings(), getRules(), loadTargets(user.sub)])
  const channels = [...new Set(leads.map((l) => leadChannel(l)))].sort()
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/leads" user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 pt-8 pb-28 sm:px-6 lg:pt-10">
        <h1 className="text-3xl font-bold tracking-tight">Automation</h1>
        <p className="text-muted-foreground">
          How leads are scored and what Google Ads hears about them. This runs by itself; change it only if you want to.{" "}
          <a href="/leads" className="text-primary underline underline-offset-4">
            Back to Leads
          </a>
        </p>
        <ScoringSettings autoStatus={scoring.autoStatus} />
        <RulesEditor initial={rules} recent={recentLeads(leads)} channels={channels} enabled={scoring.autoStatus} />
        {targets && <ConversionTargets view={targets} />}
        <div className="mt-4">
          <SendingCheck stuck={0} />
        </div>
      </main>
    </div>
  )
}
