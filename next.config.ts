import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "Getting the app ready" after an update (start.bat builds the fast version) should be quick:
  // the code is already type-checked before each update is published, so the build skips that, and
  // it keeps its work in .next/cache so the next build only redoes what the update changed.
  typescript: { ignoreBuildErrors: true },
  experimental: { turbopackFileSystemCacheForBuild: true },
  // Let phones on the same Wi-Fi open the dev server (QR code demo).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  // QR surveys became QR code conversion sources in the conversion feed.
  async redirects() {
    return [
      { source: "/surveys/new", destination: "/conversions/qr/new", permanent: false },
      { source: "/surveys/:path*", destination: "/conversions", permanent: false },
    ];
  },
};

export default nextConfig;
