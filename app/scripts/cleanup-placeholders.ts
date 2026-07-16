/**
 * One-off: remove the launch-era placeholder products (random stock covers
 * like "NEET Biology"). Real subject books, the novel and the kits stay.
 * Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/cleanup-placeholders.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const slugs = [
  "baby-steps-nursery",
  "baby-steps-lkg",
  "baby-steps-ukg",
  ...[1, 2, 3, 4, 5].map((g) => `little-leaps-grade-${g}`), // old combined per-grade books
  ...[6, 7, 8, 9, 10].map((g) => `skill-builders-grade-${g}`),
  "poems-collection-vol-1",
  // Grade kits removed 16 Jul 2026 (owner keeps only pre-primary kits)
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((g) => `grade-${g}-kit`),
  "skill-builders-grade9-geography", // merged into skill-builders-grade9-social
];

async function main() {
  // BundleItem rows cascade on product delete; order items keep their snapshot (SetNull)
  const res = await db.product.deleteMany({ where: { slug: { in: slugs } } });
  console.log(`deleted ${res.count} placeholder products`);
  const remaining = await db.product.count();
  console.log(`${remaining} products remain`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
