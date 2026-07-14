import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation powers the checkout map's "use my location"
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(self)" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Razorpay checkout script + Next inline runtime
      "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      // OSM map tiles, uploaded covers, data/blob previews
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
      "font-src 'self' data:",
      // APIs the browser calls directly
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://api.postalpincode.in https://nominatim.openstreetmap.org",
      // Razorpay renders its modal in an iframe
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
] as const;

const nextConfig: NextConfig = {
  // Self-hosted in Docker — standalone bundles server + node_modules into .next/standalone
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders.map((h) => ({ ...h })),
      },
    ];
  },
};

export default nextConfig;
