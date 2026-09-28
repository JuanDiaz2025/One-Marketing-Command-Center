import { networkInterfaces } from "node:os"
import { headers } from "next/headers"

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address
    }
  }
  return null
}

// The public link a customer's phone opens when scanning the QR code.
// Set SITE_URL once the app is deployed. In local development a phone can't
// open "localhost", so we swap in this computer's Wi-Fi address instead.
export async function getQrUrl(qrCodeId: string) {
  const configured = process.env.SITE_URL?.replace(/\/$/, "")
  if (configured) return { url: `${configured}/s/${qrCodeId}`, localOnly: false, lan: false }

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:4000"
  const proto = h.get("x-forwarded-proto") ?? "http"
  const url = new URL(`${proto}://${host}`)

  if (LOCAL_HOSTS.has(url.hostname)) {
    const lan = lanAddress()
    if (lan) {
      url.hostname = lan
      return { url: `${url.origin}/s/${qrCodeId}`, localOnly: false, lan: true }
    }
    return { url: `${url.origin}/s/${qrCodeId}`, localOnly: true, lan: false }
  }
  return { url: `${url.origin}/s/${qrCodeId}`, localOnly: false, lan: false }
}
