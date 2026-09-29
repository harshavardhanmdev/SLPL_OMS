/**
 * Adds The GenZ Times Issue 03 to a live database without running the full
 * seed, whose price catalog step would reset anything repriced in admin.
 *
 * Also demotes Issue 02 from featured and new release, so the current issue is
 * the one the store leads with. Issue 02 stays on sale as a back issue.
 *
 * Idempotent. Run:
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/add-genz-issue-03.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { BOOK_GST_BP, BOOK_HSN } from "../src/lib/sku";

const DESCRIPTION =
  `The October 2026 issue. Nobody feels ready. Begin anyway. This issue is about the gap between ` +
  `wanting to change and actually changing, which is the most ordinary finding in the psychology of ` +
  `motivation and the one nobody explains to students.\n\n` +
  `Inside Issue 03: Why We Want to Change and Why We Don't (the opening feature on the distance ` +
  `between intention and Tuesday evening), The Removal Test (ask of any reward: if this stopped next ` +
  `month, what would remain?), the evening that went into a tidied room rather than physics, Marks, ` +
  `Money or Meaning, When Motivation Dies, a visit to New Chaitanya High School at Abdullapurmet, ` +
  `what the English workshops are for, What Comes to Your Mind When You Hear Mathematics, and a ` +
  `student's own account of waiting for the mood to arrive through most of Class VIII.\n\n` +
  `Written for students of Grade 6 and above, college students, parents, teachers and school ` +
  `leaders. Preview the opening pages below before you order.`;

async function main() {
  const magazine = await db.category.findUnique({ where: { slug: "magazine" } });
  if (!magazine) throw new Error("The magazine category does not exist yet.");

  const data = {
    title: "The GenZ Times, Issue 03 (October 2026)",
    kind: "BOOK" as const,
    categoryId: magazine.id,
    series: "The GenZ Times",
    description: DESCRIPTION,
    mrp: 23400,
    price: 23400,
    weightGrams: 250,
    coverImage: "/seed/covers/genz-times-issue-03.webp",
    samplePdf: "/seed/genz-times-issue-03-preview.pdf",
    isNewRelease: true,
    isFeatured: true,
    isVisible: true,
    hsnCode: BOOK_HSN,
    gstRate: BOOK_GST_BP,
    unit: "BOOK" as const,
  };

  const issue03 = await db.product.upsert({
    where: { slug: "genz-times-issue-03" },
    update: data,
    create: { slug: "genz-times-issue-03", stock: 100, ...data },
  });
  console.log(`Issue 03 ready: Rs ${issue03.price / 100}, stock ${issue03.stock}`);

  // The current issue leads; Issue 02 stays buyable as a back issue
  const demoted = await db.product.updateMany({
    where: { slug: "genz-times-issue-02" },
    data: { isFeatured: false, isNewRelease: false },
  });
  console.log(`Issue 02 demoted to back issue: ${demoted.count} row`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
