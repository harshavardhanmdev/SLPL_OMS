/**
 * Assigns master stock register codes to products that do not have one.
 *
 * Safe to re-run: a title that already carries a SKU is left alone, so a code
 * the owner corrected by hand in admin is never overwritten. Pass --force to
 * recompute every code from the register grammar instead.
 *
 * Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-skus.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { BOOK_GST_BP, BOOK_HSN, REGISTER_TOTALS, skuFor } from "../src/lib/sku";

const force = process.argv.includes("--force");

async function main() {
  const products = await db.product.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      series: true,
      gradeLabel: true,
      kind: true,
      sku: true,
    },
    orderBy: { title: "asc" },
  });

  const taken = new Map<string, string>();
  for (const p of products) if (p.sku) taken.set(p.sku, p.title);

  let assigned = 0;
  let kept = 0;
  const uncoded: string[] = [];
  const clashes: string[] = [];

  for (const p of products) {
    if (p.kind === "BUNDLE") continue; // a kit is billed by its members
    if (p.sku && !force) {
      kept += 1;
      continue;
    }

    const sku = skuFor(p);
    if (!sku) {
      uncoded.push(`${p.series ?? "-"} | ${p.gradeLabel ?? "-"} | ${p.title}`);
      continue;
    }
    const holder = taken.get(sku);
    if (holder && holder !== p.title) {
      clashes.push(`${sku} wanted by "${p.title}", already held by "${holder}"`);
      continue;
    }

    await db.product.update({
      where: { id: p.id },
      data: { sku, hsnCode: BOOK_HSN, gstRate: BOOK_GST_BP, unit: "BOOK" },
    });
    taken.set(sku, p.title);
    assigned += 1;
  }

  console.log(`${assigned} coded, ${kept} already had a code, ${uncoded.length} uncoded`);
  console.log(`register namespace: ${taken.size} of ${REGISTER_TOTALS.total} titles in use`);

  if (clashes.length > 0) {
    console.log("\nCollisions, nothing written for these:");
    for (const c of clashes) console.log(`  ${c}`);
  }
  if (uncoded.length > 0) {
    console.log("\nNo register code for:");
    for (const u of uncoded) console.log(`  ${u}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
