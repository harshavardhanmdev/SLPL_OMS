/**
 * Prices the services so they can be quoted without retyping.
 *
 * From the owner: English workshop Rs 25,000, Radio Rs 3,00,000, FDP Rs 25,000,
 * student counselling Rs 25,000, each plus 18% GST under SAC 9992.
 *
 * Matches on the title, so a service page that has been renamed is reported
 * rather than silently skipped. Idempotent.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/seed-service-prices.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";

/** Rupees, as the owner quoted them. GST is added on top at 18%. */
const PRICES: { match: RegExp; label: string; rupees: number }[] = [
  { match: /english.*work?shop/i, label: "English workshop", rupees: 25_000 },
  { match: /radio/i, label: "Radio", rupees: 3_00_000 },
  { match: /\bfdp\b|faculty\s*development/i, label: "FDP", rupees: 25_000 },
  { match: /coun[cs]ell?ing/i, label: "Student counselling", rupees: 25_000 },
];

async function main() {
  const services = await db.servicePage.findMany({ select: { id: true, title: true } });
  if (services.length === 0) {
    console.log("No service pages exist yet. Add them in admin first.");
    return;
  }

  for (const price of PRICES) {
    const hit = services.find((s) => price.match.test(s.title));
    if (!hit) {
      console.log(`  --  ${price.label}: no service page matches, skipped`);
      continue;
    }
    await db.servicePage.update({
      where: { id: hit.id },
      data: { price: price.rupees * 100, gstRate: 1800, hsnCode: "9992" },
    });
    console.log(`  ok  ${hit.title}: Rs ${price.rupees.toLocaleString("en-IN")} plus 18% GST`);
  }

  const unpriced = await db.servicePage.findMany({
    where: { price: null },
    select: { title: true },
  });
  if (unpriced.length > 0) {
    console.log(`\nStill unpriced, quote these by hand: ${unpriced.map((s) => s.title).join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
