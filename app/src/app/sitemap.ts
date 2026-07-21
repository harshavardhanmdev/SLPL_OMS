import type { MetadataRoute } from "next";

import { db } from "@/lib/db";

// Queries the DB, so it must render at request time (no DB at build time)
export const dynamic = "force-dynamic";

const BASE = "https://store.theslpl.in";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { isVisible: true },
      select: { slug: true, updatedAt: true },
    }),
    db.category.findMany({ select: { slug: true } }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/categories`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/bundles`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/competitive-exams`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/search`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/services`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/policies/shipping`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/policies/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/policies/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/policies/refund`, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [
    ...staticPages,
    ...categories
      .filter((c) => c.slug !== "bundles")
      .map((c) => ({
        url: `${BASE}/category/${c.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ...products.map((p) => ({
      url: `${BASE}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
