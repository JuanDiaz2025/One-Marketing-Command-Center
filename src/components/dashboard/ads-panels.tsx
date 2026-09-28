import { CircleAlert, Settings } from "lucide-react"

import GoogleAdsMark from "@/components/google-ads-mark"
import GoogleButton from "@/components/google-button"
import { Button } from "@/components/ui/button"
import { disconnectAdsAction } from "@/lib/google/actions"

const connectHref = "/api/auth/google?intent=ads"

export function Panel({
  icon: Icon,
  title,
  children,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
  tone?: "default" | "error"
}) {
  return (
    <section
      className={
        tone === "error"
          ? "rounded-2xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8"
          : "rounded-2xl border bg-card p-6 shadow-xs sm:p-8"
      }
    >
      <div className="flex items-start gap-4">
        <span
          className={
            tone === "error"
              ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
              : "flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          }
        >
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {children}
        </div>
      </div>
    </section>
  )
}

export function SetupNeeded({ missing }: { missing: string[] }) {
  return (
    <Panel icon={Settings} title="Finish setting up Google Ads">
      <p className="text-muted-foreground">
        Google only lets apps read Google Ads with a developer token. Add it to the{" "}
        <code className="font-mono">.env.local</code> file in the app folder, then restart the app:
      </p>
      <ul className="font-mono text-sm">
        {missing.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Find it in Google Ads under Tools → API Center (you need a manager account). The README
        has the steps.
      </p>
    </Panel>
  )
}

export function ConnectAds() {
  return (
    <Panel icon={GoogleAdsMark} title="Connect Google Ads">
      <p className="text-muted-foreground">
        Sign in with the Google account you use for Google Ads, and allow this app to see your
        campaigns. It can be a different account from the one you signed in with here.
      </p>
      <div className="max-w-xs">
        <GoogleButton href={connectHref}>Connect Google Ads</GoogleButton>
      </div>
    </Panel>
  )
}

// Extra help for the Google Ads errors people hit most while setting up.
const hints: Record<string, string> = {
  DEVELOPER_TOKEN_NOT_APPROVED:
    "Your developer token only has test access, so it can only read test accounts. Apply for Basic access in Google Ads → Tools → API Center.",
  DEVELOPER_TOKEN_PROHIBITED:
    "This developer token belongs to a different Google Cloud project than GOOGLE_CLIENT_ID. Use a client from the same project the token was approved for.",
  NOT_ADS_USER:
    "That Google account doesn't have a Google Ads account yet. Connect the account you sign in to ads.google.com with.",
  USER_PERMISSION_DENIED:
    "This Google account can't open that Google Ads account. Ask its owner to add you under Admin → Access and security.",
  RECONNECT: "Connect Google Ads again to continue.",
}

export function AdsError({ message, code }: { message: string; code?: string }) {
  const hint = code ? hints[code] : undefined
  return (
    <Panel icon={CircleAlert} title="Google Ads didn't load" tone="error">
      <p>{message}</p>
      {hint && <p className="text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <GoogleButton href={connectHref}>Connect again</GoogleButton>
        </div>
        <DisconnectButton />
      </div>
    </Panel>
  )
}

export function DisconnectButton() {
  return (
    <form action={disconnectAdsAction}>
      <Button type="submit" variant="ghost" size="lg" className="text-destructive">
        Disconnect Google Ads
      </Button>
    </form>
  )
}
