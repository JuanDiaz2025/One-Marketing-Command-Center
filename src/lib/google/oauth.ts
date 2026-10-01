// Google sign-in (OAuth 2.0 authorization code flow with PKCE), using plain fetch.
import { createHash, randomBytes } from "node:crypto"

import { googleConfig } from "@/lib/auth/config"

export const SIGN_IN_SCOPES = ["openid", "email", "profile"]
export const ADS_SCOPE = "https://www.googleapis.com/auth/adwords"
// Sending offline conversions (interested / closed leads) back to Google Ads goes through
// Google's Data Manager API, which needs its own permission.
export const DATA_MANAGER_SCOPE = "https://www.googleapis.com/auth/datamanager"

// "signin" asks only for the Google account; "ads" also asks to manage Google Ads, and for a
// refresh token so the dashboard keeps working after the person leaves.
export type OAuthIntent = "signin" | "ads"

export function newPkce() {
  const verifier = randomBytes(32).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  return { verifier, challenge }
}

export function authorizationUrl(options: {
  intent: OAuthIntent
  redirectUri: string
  state: string
  codeChallenge: string
  loginHint?: string
}) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  const scopes = options.intent === "ads" ? [...SIGN_IN_SCOPES, ADS_SCOPE, DATA_MANAGER_SCOPE] : SIGN_IN_SCOPES
  url.search = new URLSearchParams({
    client_id: googleConfig().clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: "S256",
    include_granted_scopes: "true",
    ...(options.intent === "ads"
      ? { access_type: "offline", prompt: "consent" }
      : { prompt: "select_account" }),
    ...(options.loginHint ? { login_hint: options.loginHint } : {}),
  }).toString()
  return url.toString()
}

export type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  id_token?: string
}

async function tokenRequest(params: Record<string, string>) {
  const { clientId, clientSecret } = googleConfig()
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new OAuthError(body.error ?? "token_error", body.error_description ?? res.statusText)
  }
  return body as TokenResponse
}

export class OAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function exchangeCode(code: string, redirectUri: string, codeVerifier: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken })
}

export type GoogleUser = {
  sub: string
  email: string
  email_verified?: boolean
  name?: string
  picture?: string
}

export async function fetchUser(accessToken: string) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!res.ok) throw new OAuthError("userinfo_error", "Couldn't read your Google profile.")
  return (await res.json()) as GoogleUser
}

// Best effort: tells Google to drop the app's access when someone disconnects Google Ads.
export async function revokeToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => {})
}
