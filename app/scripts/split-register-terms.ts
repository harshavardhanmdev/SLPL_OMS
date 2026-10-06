/**
 * Renames the Grade 1 to 5 register lines to say which term they are.
 *
 * The handwritten register predates Term 2 arriving, so "Grade 1" meant Term 1
 * by default. Now that both exist the line has to say so, because a Term 2 set
 * is four titles against Term 1's six and the two cannot share a row.
 *
 * Safe to run twice. Run:
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/split-register-terms.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { setComposition } from "../src/lib/stock-register";

async function main() {
  for (const grade of [1, 2, 3, 4, 5]) {
    const from = `Grade ${grade}`;
    const to = `Grade ${grade} Term 1`;

    const counts = await db.stockCount.updateMany({
      where: { label: from },
      data: { label: to },
    });
    // Movements point at the line by label, so they move with it
    const moves = await db.stockMovement.updateMany({
      where: { label: from },
      data: { label: to },
    });

    if (counts.count || moves.count) {
      console.log(
        `${from} -> ${to}: ${counts.count} counted row, ${moves.count} movement(s), ` +
          `${setComposition(to).length} titles a set`,
      );
    } else {
      console.log(`${from}: already split, nothing to do`);
    }
  }

  const rows = await db.stockCount.findMany({
    where: { label: { startsWith: "Grade" } },
    orderBy: { sortOrder: "asc" },
    select: { label: true, inventory: true },
  });
  console.log("\nGraded lines now:");
  for (const r of rows) {
    console.log(`  ${r.label.padEnd(18)} ${r.inventory} on hand, ${setComposition(r.label).length} titles a set`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
