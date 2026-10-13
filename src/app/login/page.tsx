import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { CircleAlert, CircleCheck, Settings, TriangleAlert } from "lucide-react"

import BrandLogo from "@/components/brand-logo"
import GoogleButton from "@/components/google-button"
import { missingSignInSettings } from "@/lib/auth/config"
import { temporaryTunnel } from "@/lib/auth/local-url"
import { safeNext } from "@/lib/auth/oauth-state"
import { getSession } from "@/lib/auth/session"

export const metadata: Metadata = {
  title: "Sign in · One Marketing Command Center",
}

const errors: Record<string, string> = {
  cancelled: "Sign-in was cancelled. Try again when you're ready.",
  expired: "That sign-in link expired. Please try again.",
  not_allowed:
    "That Google account isn't allowed to use this app. Ask the owner to add it to ALLOWED_EMAILS.",
  not_configured: "Google sign-in isn't set up yet. See the steps below.",
  failed: "Google sign-in didn't go through. Please try again.",
  temporary: "Google sign-in doesn't work on this temporary address.",
  link: "That sign-in link was already used or has expired. Make a new one on the computer running the app (Open on another device, top right).",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const q = await searchParams
  const next = safeNext(typeof q.next === "string" ? q.next : undefined)
  if (await getSession()) redirect(next)

  const error = typeof q.error === "string" ? (errors[q.error] ?? errors.failed) : null
  const missing = missingSignInSettings()
  // go-online.bat's temporary address (new each time): Google only lets you sign in on addresses
  // listed in the app's Google sign-in settings, and this one can't be listed.
  const temporary = temporaryTunnel(await headers())

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <BrandLogo large />
        </div>
        <div className="mt-8 rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use your Google account. You can connect Google Ads after you sign in.
          </p>

          {q.signed_out && !error && (
            <p role="status" className="mt-5 flex gap-2 rounded-xl bg-muted p-3 text-sm">
              <CircleCheck className="mt-0.5 size-4 shrink-0" />
              You&apos;re signed out.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-5 flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          {temporary && (
            <p className="mt-5 flex gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span>
                This is a temporary address (from go-online.bat), and Google sign-in doesn&apos;t work on it. Instead, on the
                computer running the app click <strong>Open on another device</strong> (top right) and scan the QR code with
                this phone, or open its link here.
              </span>
            </p>
          )}

          <div className="mt-6">
            <GoogleButton
              href={`/api/auth/google?next=${encodeURIComponent(next)}`}
              disabled={missing.length > 0}
            >
              Continue with Google
            </GoogleButton>
          </div>
        </div>

        {missing.length > 0 && (
          <div className="mt-4 rounded-xl border border-dashed bg-card/60 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Settings className="size-4" />
              One-time setup needed
            </p>
            <p className="mt-2 text-muted-foreground">
              Add these to the <code className="font-mono">.env.local</code> file in the app
              folder, then restart the app:
            </p>
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
              {missing.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="mt-2 text-muted-foreground">
              The README explains where to get them in Google Cloud.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
