/**
 * Proves the monthly statement arithmetic: opening plus movements equals
 * closing, and this month's closing is next month's opening.
 *
 * Dev database only. It uses a throwaway register line so it cannot disturb the
 * real figures, and deletes everything it made.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-stock-ledger.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { monthlyStatement } from "../src/lib/stock-ledger";
import { setComposition } from "../src/lib/stock-register";

const LABEL = "ZZ Test Line";

function check(what: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${detail ? ` (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function cleanup() {
  await db.stockMovement.deleteMany({ where: { label: LABEL } });
}

async function main() {
  await cleanup();

  console.log("\nSet composition");
  check("a Term 1 grade set is 6 titles", setComposition("Grade 3").length === 6);
  check(
    "a Term 2 grade set is 4 titles",
    setComposition("Grade 3 Term 2").length === 4,
    setComposition("Grade 3 Term 2")
      .map((m) => m.sku)
      .join(", "),
  );
  check(
    "Term 2 SKUs end in 02",
    setComposition("Grade 3 Term 2").every((m) => m.sku.endsWith("02")),
  );
  check("Nursery is still 10 titles", setComposition("Nursery").length === 10);

  const base = {
    label: LABEL,
    series: "Test",
    unit: "SET" as const,
    recordedEmail: "test@theslpl.in",
  };

  // September: receive 500. October: issue 120, take 20 back.
  await db.stockMovement.createMany({
    data: [
      { ...base, ref: "SLPL-M-TEST-1", movedAt: new Date(2026, 8, 20), kind: "INWARD", quantity: 500 },
      { ...base, ref: "SLPL-M-TEST-2", movedAt: new Date(2026, 9, 5), kind: "OUTWARD", quantity: -120 },
      { ...base, ref: "SLPL-M-TEST-3", movedAt: new Date(2026, 9, 18), kind: "RETURN_IN", quantity: 20 },
      { ...base, ref: "SLPL-M-TEST-4", movedAt: new Date(2026, 9, 25), kind: "ADJUSTMENT", quantity: -3 },
    ],
  });

  const sep = await monthlyStatement("2026-09");
  const sepLine = sep.lines.find((l) => l.label === LABEL)!;
  console.log("\nSeptember");
  check("opens at nothing", sepLine.opening === 0, String(sepLine.opening));
  check("receives 500", sepLine.received === 500, String(sepLine.received));
  check("closes at 500", sepLine.closing === 500, String(sepLine.closing));

  const oct = await monthlyStatement("2026-10");
  const octLine = oct.lines.find((l) => l.label === LABEL)!;
  console.log("\nOctober");
  check(
    "opens where September closed",
    octLine.opening === sepLine.closing,
    `${octLine.opening} vs ${sepLine.closing}`,
  );
  check("issues 120", octLine.issued === 120, String(octLine.issued));
  check("takes 20 back", octLine.returnedIn === 20, String(octLine.returnedIn));
  check("adjusts down 3", octLine.adjusted === -3, String(octLine.adjusted));
  check("closes at 397", octLine.closing === 397, String(octLine.closing));
  check(
    "opening plus movements equals closing",
    octLine.opening +
      octLine.received +
      octLine.returnedIn -
      octLine.issued -
      octLine.returnedOut +
      octLine.adjusted ===
      octLine.closing,
  );

  const nov = await monthlyStatement("2026-11");
  const novLine = nov.lines.find((l) => l.label === LABEL)!;
  console.log("\nNovember");
  check("rolls forward to 397", novLine.opening === 397, String(novLine.opening));
  check("nothing moved", novLine.received === 0 && novLine.issued === 0);

  console.log("\nVoiding");
  await db.stockMovement.updateMany({
    where: { ref: "SLPL-M-TEST-2" },
    data: { voidedAt: new Date(), voidReason: "test" },
  });
  const octAfter = await monthlyStatement("2026-10");
  const octAfterLine = octAfter.lines.find((l) => l.label === LABEL)!;
  check("a voided issue stops counting", octAfterLine.issued === 0, String(octAfterLine.issued));
  check("and the closing moves back up", octAfterLine.closing === 517, String(octAfterLine.closing));

  await cleanup();
  console.log(
    process.exitCode === 1 ? "\nSomething above failed.\n" : "\nEvery step passed. Cleaned up.\n",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
