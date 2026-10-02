import { networkInterfaces } from "node:os"
import { headers } from "next/headers"

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

// This computer's address on the Wi-Fi or office network, skipping virtual adapters (WSL, Hyper-V,
// VirtualBox, VMware, Docker, VPNs) that phones can't reach, and private ranges first.
function lanAddress() {
  const VIRTUAL = /vethernet|virtualbox|vmware|wsl|hyper-v|docker|loopback|vpn|tailscale|zerotier|tap|tun/i
  const PRIVATE = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/
  const found: string[] = []
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (VIRTUAL.test(name)) continue
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254.")) found.push(net.address)
    }
  }
  return found.find((a) => PRIVATE.test(a)) ?? found[0] ?? null
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
