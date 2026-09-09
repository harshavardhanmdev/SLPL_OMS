/**
 * Reconciles the SKU generator against the master stock register.
 *
 * Run: npx tsx scripts/check-skus.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { skuFor } from "../src/lib/sku";

type Book = { slug: string; title: string; series: string; gradeLabel: string };

const books: Book[] = JSON.parse(
  readFileSync(path.resolve(__dirname, "../prisma/imported-books.json"), "utf8"),
);

// Written out by hand from the register sheets, to catch a generator that is
// self-consistent but wrong.
const EXPECTED: Record<string, string> = {
  "nursery-telugu": "BS1TEL01",
  "nursery-english-coursebook": "BS1ECB02",
  "nursery-english-workbook": "BS1EWB03",
  "nursery-maths-coursebook": "BS1MCB04",
  "nursery-numbers-workbook": "BS1MWB05",
  "nursery-evs-coursebook": "BS1EVCB06",
  "nursery-evs-workbook": "BS1EVWB07",
  "nursery-drawing": "BS1DRW08",
  "nursery-lines-patterns": "BS1LNP09",
  "nursery-rhymes": "BS1RYS10",
  "lkg-hindi": "BS2HIN11",
  "ukg-rhymes": "BS3RYS09",
  "ukg-hindi": "BS3HIN10",
};

let failures = 0;
const seen = new Map<string, string>();
const missing: Book[] = [];
const bySection: Record<string, number> = {};

for (const book of books) {
  const sku = skuFor(book);
  if (!sku) {
    missing.push(book);
    continue;
  }
  const clash = seen.get(sku);
  if (clash) {
    console.log(`DUPLICATE ${sku}: "${clash}" and "${book.title}"`);
    failures += 1;
  }
  seen.set(sku, book.title);
  const section = sku.startsWith("BS")
    ? "Baby Steps"
    : sku.startsWith("LL")
      ? "Little Leaps"
      : sku.startsWith("SKB")
        ? "Skill Builders"
        : "Special";
  bySection[section] = (bySection[section] ?? 0) + 1;
}

console.log(`${books.length} titles, ${seen.size} coded, ${missing.length} uncoded`);
for (const [section, count] of Object.entries(bySection)) console.log(`  ${section}: ${count}`);

console.log("\nAgainst the register by hand:");
for (const [slug, expected] of Object.entries(EXPECTED)) {
  const book = books.find((b) => b.slug === slug);
  if (!book) {
    console.log(`  ? ${slug} is not in the catalog`);
    continue;
  }
  const got = skuFor(book);
  const ok = got === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "WRONG"} ${expected.padEnd(11)} ${got ?? "null"}  ${book.title}`);
}

if (missing.length > 0) {
  console.log("\nUncoded titles:");
  for (const b of missing) console.log(`  ${b.series} | ${b.gradeLabel} | ${b.title}`);
}

console.log(`\nSample of every coded title:`);
for (const [sku, title] of [...seen].sort()) console.log(`  ${sku.padEnd(11)} ${title}`);

process.exit(failures > 0 ? 1 : 0);
