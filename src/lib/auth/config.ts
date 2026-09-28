// Settings read from .env.local (see .env.example). Nothing here is sent to the browser.

export const googleConfig = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
})

export const adsConfig = () => ({
  developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() ?? "",
  apiVersion: process.env.GOOGLE_ADS_API_VERSION?.trim() || "v25",
})

// The settings sign-in needs, by name, that are still empty.
export function missingSignInSettings() {
  const { clientId, clientSecret } = googleConfig()
  return [
    !clientId && "GOOGLE_CLIENT_ID",
    !clientSecret && "GOOGLE_CLIENT_SECRET",
  ].filter((name): name is string => Boolean(name))
}

// ALLOWED_EMAILS is a comma-separated list of addresses (bryan@example.com) and whole domains
// (@example.com). Leave it empty to let any Google account in, which is only allowed while
// running locally: a deployed app would otherwise show your leads to anyone with Gmail.
export function isEmailAllowed(email: string) {
  const entries = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!entries.length) return process.env.NODE_ENV !== "production"
  const address = email.toLowerCase()
  return entries.some((entry) =>
    entry.startsWith("@") ? address.endsWith(entry) : address === entry,
  )
}

// Where Google sends people back after they sign in. It must be listed exactly under
// "Authorized redirect URIs" in the Google Cloud OAuth client.
export function redirectUri(requestUrl: string) {
  const base = process.env.SITE_URL?.replace(/\/$/, "") || new URL(requestUrl).origin
  return `${base}/api/auth/google/callback`
}
