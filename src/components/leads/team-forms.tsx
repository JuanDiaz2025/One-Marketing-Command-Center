"use client"

import { useActionState, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { joinTeamAction, takeSenderAction } from "@/lib/leads/team-actions"

// On a teammate's computer: paste the team code from the main computer.
export function JoinTeamForm() {
  const [state, action, pending] = useActionState(joinTeamAction, undefined)
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="team-code" className="font-medium">
        Joining someone&apos;s team? Paste their team code
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="team-code"
          name="code"
          required
          autoComplete="off"
          placeholder="omcc-team:…"
          className="h-11 min-w-0 flex-1 basis-full rounded-lg border bg-card px-3 font-mono text-sm sm:basis-0"
        />
        <Button type="submit" size="lg" className="h-11 px-5" disabled={pending}>
          {pending ? "Joining…" : "Join"}
        </Button>
      </div>
      {state?.error && <p className="font-medium text-destructive">{state.error}</p>}
      {state?.joined && <p className="font-medium text-emerald-700">Joined. Leads and statuses from {state.joined} are coming in.</p>}
    </form>
  )
}

// Moves sending to Google Ads to this computer.
export function TakeSenderButton() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await takeSenderAction()
            setError(res.error ?? null)
          })
        }
      >
        {pending ? "Moving…" : "Send to Google Ads from this computer instead"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
