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
      // Razorpay checkout + Google Maps scripts + Next inline runtime.
      // Dev only: React's debugging tooling needs eval; production never does.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com https://maps.googleapis.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // OSM/Google map tiles, uploaded covers, Google avatars, data/blob previews
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.googleapis.com https://*.gstatic.com https://*.googleusercontent.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // APIs the browser calls directly
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://api.postalpincode.in https://nominatim.openstreetmap.org https://maps.googleapis.com",
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
