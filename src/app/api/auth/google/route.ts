import { NextResponse, type NextRequest } from "next/server"

import { missingSignInSettings, redirectUri } from "@/lib/auth/config"
import { redirectTo, temporaryTunnel } from "@/lib/auth/local-url"
import { newState, safeNext, saveOAuthState } from "@/lib/auth/oauth-state"
import { getSession } from "@/lib/auth/session"
import { authorizationUrl, newPkce, type OAuthIntent } from "@/lib/google/oauth"

// GET /api/auth/google?intent=signin|ads&next=/dashboard
// Sends the person to Google to sign in, or to let this app read their Google Ads.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const intent: OAuthIntent = params.get("intent") === "ads" ? "ads" : "signin"
  const next = safeNext(params.get("next"))

  if (missingSignInSettings().length) {
    return redirectTo("/login?error=not_configured")
  }

  const session = await getSession()
  if (intent === "ads" && !session) {
    return redirectTo("/login?next=/dashboard")
  }

  // Through go-online.bat's temporary address, Google would send the person back to an address
  // their browser can't use: explain instead.
  if (temporaryTunnel(request.headers)) return redirectTo(`/login?error=temporary&next=${encodeURIComponent(next)}`)

  const state = newState()
  const { verifier, challenge } = newPkce()
  await saveOAuthState({ state, verifier, intent, next })

  return NextResponse.redirect(
    authorizationUrl({
      intent,
      redirectUri: redirectUri(request.url),
      state,
      codeChallenge: challenge,
      loginHint: session?.email,
    }),
  )
}
