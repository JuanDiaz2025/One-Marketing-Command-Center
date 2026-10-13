// The app on this computer only speaks plain http. A request that reached it through a secure
// tunnel (go-online.bat) arrives marked https, but for "localhost" that address can't be opened
// ("ERR_SSL_PROTOCOL_ERROR"): use http for this computer's own addresses.
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/

export function appUrl(path: string, requestUrl: string) {
  const url = new URL(path, requestUrl)
  if (LOCAL.test(url.hostname)) url.protocol = "http:"
  return url
}
