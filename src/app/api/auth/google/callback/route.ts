import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

import { isEmailAllowed, redirectUri } from "@/lib/auth/config"
import { takeOAuthState } from "@/lib/auth/oauth-state"
import { getSession, sessionCookie } from "@/lib/auth/session"
import { saveConnection } from "@/lib/google/connections"
import { ADS_SCOPE, exchangeCode, fetchUser, OAuthError } from "@/lib/google/oauth"

// Google sends people back here after they approve (or cancel) on its consent screen.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const saved = await takeOAuthState()
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url))

  if (!saved || saved.state !== params.get("state")) return to("/login?error=expired")
  const failed = (error: string) =>
    to(saved.intent === "ads" ? `/dashboard?ads_error=${error}` : `/login?error=${error}`)

  if (params.get("error")) return failed("cancelled")
  const code = params.get("code")
  if (!code) return failed("failed")

  try {
    const tokens = await exchangeCode(code, redirectUri(request.url), saved.verifier)
    const user = await fetchUser(tokens.access_token)

    if (saved.intent === "signin") {
      if (!user.email_verified || !isEmailAllowed(user.email)) return failed("not_allowed")
      ;(await cookies()).set(
        await sessionCookie({
          sub: user.sub,
          email: user.email,
          name: user.name || user.email,
          picture: user.picture,
        }),
      )
      return to(saved.next)
    }

    // Connecting Google Ads. The Ads login can be a different Google account than the one used
    // to sign in (ads often live under another Gmail); it's saved for the signed-in person.
    const session = await getSession()
    if (!session) return to("/login?next=/dashboard")
    if (!tokens.scope.split(" ").includes(ADS_SCOPE)) return failed("scope")
    if (!tokens.refresh_token) return failed("no_refresh_token")
    await saveConnection(session.sub, user.email, tokens.refresh_token, tokens.scope.split(" "))
    return to("/dashboard?connected=1")
  } catch (error) {
    console.error("Google sign-in failed:", error instanceof OAuthError ? error.message : error)
    return failed("failed")
  }
}
