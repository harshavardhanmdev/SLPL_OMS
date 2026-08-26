import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Tracking links are private to the person who filed the complaint
      disallow: ["/admin", "/api/", "/account", "/checkout", "/media/receipt-", "/grievance/track/"],
    },
    sitemap: "https://store.theslpl.in/sitemap.xml",
  };
}
