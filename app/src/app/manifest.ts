import type { MetadataRoute } from "next";

/**
 * Lets the back office be added to a phone's home screen, so logging a bill is
 * an icon tap rather than a browser, a URL and a sign-in.
 *
 * start_url points at the expense log because that is what gets opened on a
 * phone. The store itself is browsed in a normal browser tab.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SLPL Back office",
    short_name: "SLPL",
    description: "Log an expense and see where the money went.",
    start_url: "/erp/expenses",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1E2A5A",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
