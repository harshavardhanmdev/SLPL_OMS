import "server-only";

import { db } from "@/lib/db";
import type { SampleBook, Series } from "@/lib/sample-parse";

const KG = ["Nursery", "LKG", "UKG"];

function gradeOf(text: string): string | null {
  const kg = KG.find((k) => new RegExp(`\\b${k}\\b`, "i").test(text));
  if (kg) return kg;
  return text.match(/\bGrade\s*(\d{1,2})\b/i)?.[1] ?? null;
}

const seriesOf = (s: string): Series | null =>
  /^baby steps/i.test(s)
    ? "BS"
    : /^little leaps/i.test(s)
      ? "LL"
      : /^upsc full sets?/i.test(s)
        ? "UPSC"
        : /^skill builders/i.test(s)
          ? "SKB"
          : /^upsc foundation/i.test(s)
            ? "UPSCF"
            : /genz/i.test(s)
              ? "GENZ"
              : null;

/**
 * Every book a sample can be, for the samples box to match against. Baby
 * Steps, Little Leaps and the UPSC grade sets come from the price list, which
 * has their Term 2 books and full sets; everything else from the store
 * catalogue. Prices are not read.
 */
export async function sampleBooks(): Promise<SampleBook[]> {
  const [prices, products] = await Promise.all([
    db.priceListItem.findMany({
      where: { isActive: true },
      orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
      select: { id: true, group: true, description: true, contents: true },
    }),
    db.product.findMany({
      where: { isActive: true, kind: { not: "DIGITAL" } },
      orderBy: [{ series: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        series: true,
        gradeLabel: true,
        kind: true,
        bundleItems: { select: { product: { select: { title: true } } } },
      },
    }),
  ]);

  const books: SampleBook[] = [];
  for (const p of prices) {
    const series = seriesOf(p.group);
    if (series !== "BS" && series !== "LL" && series !== "UPSC") continue;
    // Term 2 books are named "... (included in the full set)": a book, not a set
    const title = p.description.replace(/\s*\(included in the full set\)/i, "");
    books.push({
      key: `price:${p.id}`,
      title,
      series,
      grade: gradeOf(p.description) ?? gradeOf(p.group),
      term2: /\bterm\s*2\b/i.test(title),
      isSet: /\bfull set\b/i.test(title),
      contents: p.contents,
      productId: null,
    });
  }
  // A set with no list of its books gets one from its grade's titles, without
  // repeating "Little Leaps Grade 5" before every one
  for (const set of books.filter((b) => b.isSet && !b.contents)) {
    const prefix = set.title.replace(/\s*full set.*$/i, "");
    const titles = books
      .filter((b) => b.series === set.series && b.grade === set.grade && !b.isSet)
      .map((b) => (b.title.startsWith(`${prefix} `) ? b.title.slice(prefix.length + 1) : b.title));
    if (titles.length) set.contents = titles.join(" · ");
  }

  const fromPrices = new Set(books.map((b) => b.series));
  for (const p of products) {
    const series = seriesOf(p.series ?? "") ?? "OTHER";
    // Already there from the price list, with Term 2 books and full sets
    if (fromPrices.has(series)) continue;
    books.push({
      key: `product:${p.id}`,
      title: p.title,
      series,
      grade: p.gradeLabel ? gradeOf(p.gradeLabel) : null,
      term2: false,
      isSet: p.kind === "BUNDLE",
      contents: p.bundleItems.length ? p.bundleItems.map((i) => i.product.title).join(" · ") : null,
      productId: p.id,
    });
  }
  return books;
}
