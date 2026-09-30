/**
 * Adds the digital edition of The GenZ Times Issue 03 without running the full
 * seed, whose price catalog step would reset anything repriced in admin.
 *
 * The page images must already be in the uploads volume under
 * editions/genz-times-issue-03. See scripts/render-edition.py.
 *
 * Idempotent. Run:
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/add-genz-issue-03-digital.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { BOOK_HSN } from "../src/lib/sku";

const EDITION_KEY = "genz-times-issue-03";
const PAGE_COUNT = 64;

const DESCRIPTION =
  `The October 2026 issue, to read online. Nobody feels ready. Begin anyway.\n\n` +
  `The same magazine as the printed copy, opened in your browser instead of posted to you. ` +
  `Inside: Why We Want to Change and Why We Don't, The Removal Test, the evening that went into a ` +
  `tidied room rather than physics, Marks, Money or Meaning, When Motivation Dies, a visit to New ` +
  `Chaitanya High School at Abdullapurmet, what the English workshops are for, and a student's own ` +
  `account of waiting for the mood to arrive.\n\n` +
  `It opens on any device you sign in on and it does not expire. This is your personal copy: every ` +
  `page carries your name and licence number, so please do not pass pages on. There is no file to ` +
  `download, and reading needs an internet connection.`;

async function main() {
  const magazine = await db.category.findUnique({ where: { slug: "magazine" } });
  if (!magazine) throw new Error("The magazine category does not exist yet.");

  // Share the cover and the free sample with the printed issue
  const print = await db.product.findUnique({
    where: { slug: "genz-times-issue-03" },
    select: { coverImage: true, samplePdf: true },
  });
  if (!print) throw new Error("Add the printed Issue 03 first.");

  const data = {
    title: "The GenZ Times, Issue 03 (October 2026), digital edition",
    kind: "DIGITAL" as const,
    categoryId: magazine.id,
    series: "The GenZ Times",
    description: DESCRIPTION,
    // Rs 126 including 5% GST: Rs 120 taxable plus Rs 6. A printed book is nil
    // rated, but an e-book with a print edition is 5% in India.
    mrp: 12600,
    price: 12600,
    salePrice: null,
    weightGrams: 0,
    coverImage: print.coverImage,
    samplePdf: print.samplePdf,
    pageCount: PAGE_COUNT,
    editionKey: EDITION_KEY,
    isNewRelease: true,
    isFeatured: false,
    isVisible: true,
    hsnCode: BOOK_HSN,
    gstRate: 500,
    unit: "BOOK" as const,
  };

  const product = await db.product.upsert({
    where: { slug: "genz-times-issue-03-digital" },
    update: data,
    // Nothing leaves a shelf, and lib/stock.ts skips DIGITAL entirely
    create: { slug: "genz-times-issue-03-digital", stock: 0, ...data },
  });

  console.log(
    `Digital Issue 03 ready: Rs ${product.price / 100}, ${product.pageCount} pages, ` +
      `edition ${product.editionKey}, GST ${product.gstRate / 100}%`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
