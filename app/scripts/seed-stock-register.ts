/**
 * Loads the handwritten master stock register into StockCount.
 *
 * Idempotent on (asOf, label), so re-running a corrected transcription updates
 * the same rows rather than duplicating the count.
 *
 * Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/seed-stock-register.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";

import { db } from "../src/lib/db";
import { copiesFor, type RegisterRow } from "../src/lib/stock-register";

type File = { asOf: string; rows: RegisterRow[] };

async function main() {
  const file = JSON.parse(
    readFileSync(path.resolve(__dirname, "../prisma/stock-register-2026.json"), "utf8"),
  ) as File;
  const asOf = new Date(file.asOf);

  let bad = 0;
  for (const [i, r] of file.rows.entries()) {
    if (r.inward - r.outward !== r.inventory) {
      console.log(`  does not reconcile: ${r.label} ${r.inward} - ${r.outward} != ${r.inventory}`);
      bad += 1;
      continue;
    }
    await db.stockCount.upsert({
      where: { asOf_label: { asOf, label: r.label } },
      update: { ...r, sortOrder: i, asOf },
      create: { ...r, sortOrder: i, asOf },
    });
  }

  const rows = await db.stockCount.findMany({ where: { asOf }, orderBy: { sortOrder: "asc" } });
  const copies = rows.reduce(
    (acc, r) => {
      const c = copiesFor(r as unknown as RegisterRow);
      return {
        inward: acc.inward + c.inward,
        outward: acc.outward + c.outward,
        inventory: acc.inventory + c.inventory,
      };
    },
    { inward: 0, outward: 0, inventory: 0 },
  );
  console.log(`${rows.length} rows stored for ${file.asOf}, ${bad} rejected`);
  console.log(
    `in copies: ${copies.inward} received, ${copies.outward} issued, ${copies.inventory} on hand`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
