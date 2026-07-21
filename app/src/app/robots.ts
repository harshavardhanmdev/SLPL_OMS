import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/account", "/checkout", "/media/receipt-"],
    },
    sitemap: "https://store.theslpl.in/sitemap.xml",
  };
}
