import type { NextConfig } from "next";

// SITE_URL's host, written with or without https:// (a typo there mustn't stop DealTrack).
function siteHost() {
  const site = process.env.SITE_URL?.trim()
  if (!site) return []
  try {
    return [new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).host]
  } catch {
    return []
  }
}

const nextConfig: NextConfig = {
  // Buttons (server actions) used through go-online.bat's tunnel, or a permanent address: the app
  // sees its own address there, and Next.js would otherwise refuse them as coming from elsewhere.
  experimental: {
    serverActions: {
      allowedOrigins: ["*.trycloudflare.com", ...siteHost()],
    },
  },
};

export default nextConfig;
