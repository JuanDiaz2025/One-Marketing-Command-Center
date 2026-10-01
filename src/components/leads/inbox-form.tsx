"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { saveInboxAction } from "@/lib/leads/inbox-actions"

export default function InboxForm({ current }: { current?: string }) {
  const [state, action, pending] = useActionState(saveInboxAction, undefined)
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="inbox-url" className="font-medium">
        Inbox address (the Web app URL from step 3)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="inbox-url"
          name="url"
          defaultValue={current}
          placeholder="https://script.google.com/macros/s/…/exec"
          className="h-10 min-w-0 flex-1 rounded-lg border bg-card px-3 font-mono text-xs"
        />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {state?.error && <p className="text-destructive">{state.error}</p>}
      {state?.saved && <p className="text-emerald-700">Saved. Leads in the inbox are being brought in.</p>}
    </form>
  )
}
