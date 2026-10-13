"use client"

import { useActionState } from "react"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { passwordSignInAction, setPasswordAction } from "@/lib/auth/password-actions"

const input = "h-11 w-full rounded-lg border bg-card px-3 text-sm"

// Sign in with the team password (the sign-in page).
export function PasswordSignIn({ next }: { next: string }) {
  const [state, action, pending] = useActionState(passwordSignInAction, undefined)
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Your name
        <input name="name" autoComplete="name" placeholder="e.g. Maria" defaultValue={state?.name} key={state?.name ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Team password
        <input name="password" type="password" required autoComplete="current-password" className={input} />
      </label>
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        <KeyRound data-icon="inline-start" />
        {pending ? "Signing in…" : "Sign in with the team password"}
      </Button>
      {state?.error && <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p>}
    </form>
  )
}

// Set or change the team password (for someone signed in with Google).
export function SetPassword({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(setPasswordAction, undefined)
  return (
    <form action={action} className="flex flex-col gap-2 border-t pt-3">
      <p className="font-semibold">Team password</p>
      <p className="text-muted-foreground">
        {hasPassword
          ? "Set. Anyone with it can sign in on the go-online address or any computer, without Google. Change it here."
          : "A password your team can sign in with on the go-online address or any computer, without Google."}
      </p>
      <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="New password" aria-label="New password" className={input} />
      <input name="confirm" type="password" required autoComplete="new-password" placeholder="Type it again" aria-label="Type the new password again" className={input} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
      </Button>
      {state?.error && <p className="text-destructive">{state.error}</p>}
      {state?.saved && <p className="text-emerald-700">Saved.</p>}
    </form>
  )
}
