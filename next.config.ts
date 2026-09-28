import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
