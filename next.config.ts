import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Buttons (server actions) used through go-online.bat's tunnel, or a permanent address: the app
  // sees its own address there, and Next.js would otherwise refuse them as coming from elsewhere.
  experimental: {
    serverActions: {
      allowedOrigins: ["*.trycloudflare.com", ...(process.env.SITE_URL ? [new URL(process.env.SITE_URL).host] : [])],
    },
  },
};

export default nextConfig;
