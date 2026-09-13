/**
 * Adds the Competitive Exams category and its five titles to a live database
 * without running the full seed.
 *
 * The seed's price catalog step rewrites MRP and price for 113 slugs, which
 * would undo anything the owner has repriced in admin. This touches only the
 * new rows.
 *
 * Idempotent. Run:
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/add-competitive-titles.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { BOOK_GST_BP, BOOK_HSN, skuFor } from "../src/lib/sku";

const UPSC_VOLUMES = [
  { n: 1, chapters: 46, questions: "1,063", exercises: "500+", pyq: "50+", tests: "1 grand test" },
  { n: 2, chapters: 31, questions: "1,146", exercises: "500+", pyq: "50+", tests: "1 grand test" },
  { n: 3, chapters: 61, questions: "2,405", exercises: "1100+", pyq: "120+", tests: "3 grand tests" },
];

async function upsert(p: {
  slug: string;
  title: string;
  kind?: "BOOK" | "BUNDLE";
  categoryId: string;
  series: string;
  description: string;
  mrp: number;
  price: number;
  weightGrams: number;
  coverImage: string;
  isVisible?: boolean;
  isNewRelease?: boolean;
  isFeatured?: boolean;
}) {
  const sku = p.kind === "BUNDLE" ? null : skuFor({ slug: p.slug, title: p.title, series: p.series });
  const data = {
    title: p.title,
    kind: p.kind ?? ("BOOK" as const),
    categoryId: p.categoryId,
    series: p.series,
    description: p.description,
    mrp: p.mrp,
    price: p.price,
    weightGrams: p.weightGrams,
    coverImage: p.coverImage,
    isVisible: p.isVisible ?? true,
    isNewRelease: p.isNewRelease ?? false,
    isFeatured: p.isFeatured ?? false,
    sku,
    hsnCode: BOOK_HSN,
    gstRate: BOOK_GST_BP,
    unit: "BOOK" as const,
  };
  const row = await db.product.upsert({
    where: { slug: p.slug },
    update: data,
    create: { slug: p.slug, stock: 100, ...data },
  });
  console.log(`  ${p.slug.padEnd(26)} ${(sku ?? "-").padEnd(11)} MRP ${p.mrp / 100}, selling ${p.price / 100}`);
  return row;
}

async function main() {
  const category = await db.category.upsert({
    where: { slug: "competitive-exams" },
    update: {},
    create: {
      slug: "competitive-exams",
      name: "Competitive Exams",
      description:
        "UPSC Civils foundation material and competitive English from SLPL - built for aspirants, by educators.",
      sortOrder: 4,
    },
  });
  console.log(`category ${category.slug} ready`);

  await upsert({
    slug: "advanced-english",
    title: "Workshop on Advanced English: Student Handbook",
    categoryId: category.id,
    series: "Workshops",
    description:
      `Ten progressive workshops that build confidence, sharpen thinking and transform the way you communicate. ` +
      `From grammar to public speaking, from vocabulary to interviews: everything needed to excel in academics, ` +
      `careers and competitive exams. Inside are practice worksheets, a language reference covering vocabulary, ` +
      `idioms, phrasal verbs and common errors, multiple tests and a Grand Competitive English Test. ` +
      `Written by Ramesh Mamidala, Professor of English. Useful for SSC, Bank, UPSC, NID, CDS, NDA, CLAT, CAT and more.`,
    mrp: 45900,
    price: 37000,
    weightGrams: 400,
    coverImage: "/seed/covers/advanced-english.webp",
    isNewRelease: true,
    isFeatured: true,
  });

  const volumeIds: string[] = [];
  for (const v of UPSC_VOLUMES) {
    const row = await upsert({
      slug: `upsc-foundation-volume-${v.n}`,
      title: `UPSC Foundation Volume ${v.n}: Social Science`,
      categoryId: category.id,
      series: "UPSC Foundation",
      description:
        `Saaradaa's CSAP UPSC Foundation Volume ${v.n} is a comprehensive guide to Social Science, designed strictly ` +
        `as per the NCERT syllabus and aligned with the UPSC Civil Services Examination pattern. Part A History, ` +
        `Part B Economics, Part C Political Science and Part D Geography. ` +
        `${v.chapters} chapters, ${v.questions} questions, ${v.exercises} practice exercises and worksheets, ` +
        `${v.pyq} previous year pattern questions from 2013 to 2025, and ${v.tests}. ` +
        `Compiled by the Saaradaa Academic Team, edited by Ramesh Mamidala. 2026 edition. ` +
        `Sold as part of the complete three volume set.`,
      mrp: 106600,
      price: 83300,
      weightGrams: 600,
      coverImage: `/seed/covers/upsc-foundation-volume-${v.n}.webp`,
      isVisible: false,
    });
    volumeIds.push(row.id);
  }

  const set = await upsert({
    slug: "upsc-foundation-set",
    title: "UPSC Foundation: Complete Set of 3 Volumes",
    kind: "BUNDLE",
    categoryId: category.id,
    series: "UPSC Foundation",
    description:
      `All three volumes of Saaradaa's CSAP UPSC Foundation in one set: the complete Social Science foundation for ` +
      `the civil services aspirant, strictly as per the NCERT syllabus and aligned with the UPSC Civil Services ` +
      `Examination pattern. Across the three volumes: 138 chapters, 4,614 questions, 2,100 plus practice exercises ` +
      `and worksheets, 220 plus previous year pattern questions from 2013 to 2025, and 5 grand tests. ` +
      `Also useful for SSC, state PSCs, NDA, CDS, banking, CLAT and CAT. ` +
      `Compiled by the Saaradaa Academic Team, edited by Ramesh Mamidala. 2026 edition.`,
    mrp: 319900,
    price: 249900,
    weightGrams: 1800,
    coverImage: "/seed/covers/upsc-foundation-set.webp",
    isNewRelease: true,
    isFeatured: true,
  });

  for (const productId of volumeIds) {
    await db.bundleItem.upsert({
      where: { bundleId_productId: { bundleId: set.id, productId } },
      update: { quantity: 1 },
      create: { bundleId: set.id, productId, quantity: 1 },
    });
  }
  console.log(`set holds ${volumeIds.length} volumes`);

  // The set is assembled from its volumes, so its stock is derived
  const members = await db.product.findMany({
    where: { id: { in: volumeIds } },
    select: { stock: true },
  });
  const buildable = Math.max(0, Math.min(...members.map((m) => m.stock)));
  await db.product.update({ where: { id: set.id }, data: { stock: buildable } });
  console.log(`set stock derived from members: ${buildable}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
