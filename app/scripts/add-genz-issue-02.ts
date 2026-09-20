/**
 * Adds The GenZ Times Issue 02 to a live database without running the full
 * seed, whose price catalog step would reset anything repriced in admin.
 *
 * Also demotes Issue 01 from featured and new release, so the current issue is
 * the one the store leads with. Issue 01 stays on sale as a back issue.
 *
 * Idempotent. Run:
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/add-genz-issue-02.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { BOOK_GST_BP, BOOK_HSN } from "../src/lib/sku";

const DESCRIPTION =
  `The September 2026 Future-Ready Edition. If the world has changed, have you changed with it? ` +
  `This issue is about redesigning yourself for the world that is arriving, not the one that has gone.\n\n` +
  `Inside Issue 02: The Time We Kill, the Future We Lose (India's quiet epidemic of wasted hours and what it ` +
  `really costs), The Great Academic Crossover (science to civics, law, finance, policy and public life), ` +
  `When the Scientist Starts Studying Society, The Narrow Side of the Human Brain (what convenience is quietly ` +
  `doing to attention), Your Stream Is Not Your Destiny, The Crossover Map (the centre spread: every route out ` +
  `of one marksheet), Stop Choosing Careers for Your Children, and Speaking Skills and Grooming.\n\n` +
  `Written for students of Grade 6 and above, college students, parents, teachers and school leaders. ` +
  `Preview the opening pages below before you order.`;

async function main() {
  const magazine = await db.category.findUnique({ where: { slug: "magazine" } });
  if (!magazine) throw new Error("The magazine category does not exist yet.");

  const data = {
    title: "The GenZ Times, Issue 02 (September 2026)",
    kind: "BOOK" as const,
    categoryId: magazine.id,
    series: "The GenZ Times",
    description: DESCRIPTION,
    mrp: 23400,
    price: 23400,
    weightGrams: 250,
    coverImage: "/seed/covers/genz-times-issue-02.webp",
    samplePdf: "/seed/genz-times-issue-02-preview.pdf",
    isNewRelease: true,
    isFeatured: true,
    isVisible: true,
    hsnCode: BOOK_HSN,
    gstRate: BOOK_GST_BP,
    unit: "BOOK" as const,
  };

  const issue02 = await db.product.upsert({
    where: { slug: "genz-times-issue-02" },
    update: data,
    // The register counts 100 copies of September on hand, nothing issued
    create: { slug: "genz-times-issue-02", stock: 100, ...data },
  });
  console.log(`Issue 02 ready: Rs ${issue02.price / 100}, stock ${issue02.stock}`);

  // The current issue leads; Issue 01 stays buyable as a back issue
  const demoted = await db.product.updateMany({
    where: { slug: "genz-times-issue-01" },
    data: { isFeatured: false, isNewRelease: false },
  });
  console.log(`Issue 01 demoted to back issue: ${demoted.count} row`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
