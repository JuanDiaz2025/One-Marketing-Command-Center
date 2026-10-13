// The app on this computer only speaks plain http. A request that reached it through a secure
// tunnel (go-online.bat) arrives marked https, but for "localhost" that address can't be opened
// ("ERR_SSL_PROTOCOL_ERROR"): use http for this computer's own addresses.
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/

export function appUrl(path: string, requestUrl: string) {
  const url = new URL(path, requestUrl)
  if (LOCAL.test(url.hostname)) url.protocol = "http:"
  return url
}

// A redirect to a page of this app, given as a path: the browser stays on whatever address it's
// using (this computer's, or a tunnel's), instead of being sent to one it may not be able to open.
export function redirectTo(path: string, status = 307) {
  return new Response(null, { status, headers: { Location: path, "Cache-Control": "no-store" } })
}

// Opened through go-online.bat's temporary tunnel (a new address each time, so Google sign-in
// can't work there): Cloudflare marks every request it forwards. With SITE_URL set (a permanent
// address), the tunnel is the real way in, and sign-in works.
export function temporaryTunnel(headers: Headers) {
  if (process.env.SITE_URL?.trim()) return false
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(":")[0]
  return /\.trycloudflare\.com$/i.test(host) || headers.has("cf-ray") || headers.has("cf-connecting-ip")
}
