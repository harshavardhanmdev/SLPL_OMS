/**
 * Seed the SLPL Store catalog.
 *
 * Idempotent (upserts by slug/key) - safe to re-run.
 * Every product starts isVisible=false: the owner sets real prices in the
 * admin panel and flips visibility when ready. Prices below are placeholders
 * in paise (₹349 = 34900).
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { BOOK_GST_BP, BOOK_HSN, skuFor } from "../src/lib/sku";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function upsertCategory(slug: string, name: string, description: string, sortOrder: number) {
  return db.category.upsert({
    where: { slug },
    update: { name, description, sortOrder },
    create: { slug, name, description, sortOrder },
  });
}

type ProductSeed = {
  slug: string;
  title: string;
  kind?: "BOOK" | "NOVEL" | "POEMS" | "BUNDLE";
  categoryId: string;
  series?: string;
  gradeLabel?: string;
  description: string;
  mrp: number;
  price: number;
  stock?: number;
  weightGrams?: number;
  coverImage?: string;
  samplePdf?: string;
  isNewRelease?: boolean;
  isFeatured?: boolean;
  isVisible?: boolean;
};

async function upsertProduct(p: ProductSeed) {
  const data = {
    title: p.title,
    kind: p.kind ?? ("BOOK" as const),
    categoryId: p.categoryId,
    series: p.series,
    gradeLabel: p.gradeLabel,
    description: p.description,
    mrp: p.mrp,
    price: p.price,
    stock: p.stock ?? 100,
    weightGrams: p.weightGrams ?? 350,
    coverImage: p.coverImage,
    samplePdf: p.samplePdf,
    isNewRelease: p.isNewRelease ?? false,
    isFeatured: p.isFeatured ?? false,
    // Placeholder prices; owner sets real ones in /admin.
    isVisible: p.isVisible ?? true,
  };
  return db.product.upsert({
    where: { slug: p.slug },
    update: data,
    create: { slug: p.slug, ...data },
  });
}

async function main() {
  // ── Categories ──────────────────────────────────────────────────────────
  const prePrimary = await upsertCategory(
    "pre-primary",
    "Pre-Primary",
    "Baby Steps series for Nursery, LKG and UKG - a joyful first step into letters, numbers and the world around.",
    1,
  );
  const primary = await upsertCategory(
    "primary",
    "Primary",
    "Little Leaps series for Grades 1-5 - concept-first learning aligned with state and national curricula.",
    2,
  );
  const highSchool = await upsertCategory(
    "high-school",
    "High School",
    "Skill Builders series for Grades 6-10 - rigorous practice modules that bridge school syllabus and competitive readiness.",
    3,
  );
  const competitive = await upsertCategory(
    "competitive-exams",
    "Competitive Exams",
    "UPSC Civils foundation material and competitive English from SLPL - built for aspirants, by educators.",
    4,
  );
  const seniorSec = await upsertCategory(
    "senior-secondary",
    "Senior Secondary",
    "Focused material for Grades 11-12 - clarity, depth and exam-ready practice.",
    5,
  );
  const novelsPoems = await upsertCategory(
    "novels-poems",
    "Novels & Poems",
    "Stories and verse from SLPL - reading that builds language and character.",
    6,
  );
  const magazine = await upsertCategory(
    "magazine",
    "The GenZ Times",
    "Our monthly education and youth magazine - careers, technology, leadership and ideas for the next generation.",
    7,
  );
  const bundles = await upsertCategory(
    "bundles",
    "Class Bundles",
    "Everything a class needs in one box - complete book sets at a bundled price.",
    8,
  );

  // ── Novels & Poems ──────────────────────────────────────────────────────
  const novel: ProductSeed = {
    slug: "life-of-student",
    title: "Life of Student: A Tale of Four Students",
    kind: "NOVEL",
    categoryId: novelsPoems.id,
    description:
      `Life of Student is written by Ramesh Mamidala, a compassionate educator and evocative writer whose work gives ` +
      `voice to the silent and untold dreams of Indian students. Drawn from two decades of teaching and mentoring, from ` +
      `counseling rooms echoing with unspoken fears to classrooms that thirst for creativity, this is more than fiction: ` +
      `a mirror, a movement and a manifesto for every learner burdened by a system that demands scores but silences questions.`,
    mrp: 44900,
    price: 39900, // real price set by owner: ₹399
    weightGrams: 300,
    coverImage: "/seed/covers/life-of-student.webp",
    isNewRelease: true,
    isFeatured: true,
  };

  // ── Little Leaps per-subject books (real covers from assets/cover_pages) ─
  const subjectBlurb: Record<string, string> = {
    English: "reading, phonics, grammar-in-use and confident speaking",
    Telugu: "varnamala, padalu, reading fluency and handwriting practice",
    Hindi: "varnmala, matras, vocabulary and simple sentence practice",
    Math: "numbers, operations, shapes and everyday problem solving",
    Computer: "computer basics, digital habits and hands-on activities",
    GK: "the world around us, current awareness and thinking questions",
    Social: "family, neighbourhood, our country and community life",
  };
  const subjectCovers: [number, string][] = [
    [1, "Computer"], [1, "English"], [1, "GK"], [1, "Hindi"], [1, "Social"], [1, "Telugu"],
    [2, "Math"],
    [3, "Computer"], [3, "GK"], [3, "Hindi"],
    [4, "Computer"], [4, "GK"], [4, "Telugu"],
  ];
  const subjectBooks: ProductSeed[] = subjectCovers.map(([grade, subject]) => ({
    slug: `little-leaps-grade${grade}-${subject.toLowerCase()}`,
    title: `Little Leaps ${subject === "GK" ? "General Knowledge" : subject}, Grade ${grade}`,
    categoryId: primary.id,
    series: "Little Leaps",
    gradeLabel: `Grade ${grade}`,
    description:
      `The Little Leaps ${subject === "GK" ? "General Knowledge" : subject} book for Grade ${grade}, covering ${subjectBlurb[subject]}. ` +
      `Research-oriented design: every chapter opens with a real-life hook and closes with skill checks students can self-correct. ` +
      `Full-colour pages with QR-linked lessons on the SLPL LMS. ` +
      `Part of the complete Little Leaps set for Grade ${grade}.`,
    mrp: 29900, // dummy values, owner edits in admin
    price: 24900,
    weightGrams: 350,
    coverImage: `/seed/covers/subjects/grade${grade}_${subject.toLowerCase()}.png`,
    isNewRelease: true,
  }));

  // ── Poem books ──────────────────────────────────────────────────────────
  const poems: ProductSeed[] = [
    {
      slug: "seasons-of-my-soul",
      title: "Seasons of My Soul",
      kind: "POEMS",
      categoryId: novelsPoems.id,
      description:
        `An anthology of nature poetry by Ramesh Mamidala, a progressive writer whose verses personify ` +
        `nature in her originality. In this collection, AGNI speaks volumes about his deeper understanding of ` +
        `nature and his close, emotional attachment to her: inspiration drawn from the outdoors with the touch ` +
        `of Miltonic power. Through his poetry, Ramesh invites readers to evoke love for nature and preserve ` +
        `her properly for our next generations.`,
      mrp: 34900,
      price: 29900, // dummy, owner edits in admin
      weightGrams: 250,
      coverImage: "/seed/covers/seasons-of-my-soul.webp",
      isNewRelease: true,
    },
    {
      slug: "pusthakavilapam",
      title: "Pusthakavilapam (Telugu)",
      kind: "POEMS",
      categoryId: novelsPoems.id,
      description:
        `Pusthakavilapam, the lament of books, by Ramesh Mamidala. This is not just a story: it is a mirror ` +
        `held up to our society and a quiet anguish over the reading habits we are losing. A Telugu work that ` +
        `asks what happens to us when books fall silent, and gently calls readers back to them. ` +
        `From the SLPL publishing house.`,
      mrp: 24900,
      price: 19900, // dummy, owner edits in admin
      weightGrams: 200,
      coverImage: "/seed/covers/pusthakavilapam.webp",
      isNewRelease: true,
    },
  ];

  // ── The GenZ Times (monthly magazine) ───────────────────────────────────
  const genzTimes: ProductSeed = {
    slug: "genz-times-issue-01",
    title: "The GenZ Times, Issue 01 (August 2026)",
    kind: "BOOK",
    categoryId: magazine.id,
    series: "The GenZ Times",
    description:
      `The inaugural issue of The GenZ Times, a premium monthly education and youth magazine from Saaradaa ` +
      `Learknowations. Sixty-four pages on artificial intelligence in the classroom, the careers taking shape ` +
      `around this generation, the skills worth learning now and the young change makers already at work.\n\n` +
      `Inside Issue 01: Are We Turning Around? (AI has entered the classroom, are we steering it), The Gen Z Pulse, ` +
      `Career and Beyond (a centre-spread map of ten worlds a student can build a life in), How Close Are We to Chitti, ` +
      `SchoolCast on SL Radio, Developing Reading Habits by Ramesh Mamidala, The Scholarship Search and Brain Boosters.\n\n` +
      `Written for students of Grade 6 and above, college students, parents, teachers and school leaders. ` +
      `Preview the opening pages below before you order.`,
    mrp: 23400,
    price: 23400, // cover price ₹234
    weightGrams: 250,
    coverImage: "/seed/covers/genz-times-issue-01.webp",
    samplePdf: "/seed/genz-times-issue-01-preview.pdf",
    isNewRelease: true,
    isFeatured: true,
  };

  const allBooks = [...subjectBooks, novel, genzTimes, ...poems];
  const created: Record<string, { id: string; price: number }> = {};
  for (const p of allBooks) {
    const row = await upsertProduct(p);
    created[p.slug] = { id: row.id, price: row.price };
  }
  // The novel's price and cover are owner-final: force them on re-seed
  await db.product.update({
    where: { slug: "life-of-student" },
    data: {
      title: novel.title,
      description: novel.description,
      mrp: novel.mrp,
      price: novel.price,
      coverImage: novel.coverImage,
      isFeatured: true,
    },
  });
  // Same for the magazine: cover price and artwork are owner-final
  await db.product.update({
    where: { slug: "genz-times-issue-01" },
    data: {
      title: genzTimes.title,
      description: genzTimes.description,
      mrp: genzTimes.mrp,
      price: genzTimes.price,
      coverImage: genzTimes.coverImage,
      samplePdf: genzTimes.samplePdf,
      isFeatured: true,
    },
  });

  // ── Competitive exams (covers received 12 Sep 2026) ─────────────────────
  // Real prices from the owner: MRP with a genuine discount, so the strike
  // through on the card is the published rate, not a placeholder.
  await upsertProduct({
    slug: "advanced-english",
    title: "Workshop on Advanced English: Student Handbook",
    categoryId: competitive.id,
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

  // The three volumes sell only as the complete set (owner decision,
  // 12 Sep 2026), so they stay invisible and carry the set price split three
  // ways for internal stock and costing. The set below holds them.
  const upscVolumes = [
    { n: 1, chapters: 46, questions: "1,063", exercises: "500+", pyq: "50+", tests: "1 grand test" },
    { n: 2, chapters: 31, questions: "1,146", exercises: "500+", pyq: "50+", tests: "1 grand test" },
    { n: 3, chapters: 61, questions: "2,405", exercises: "1100+", pyq: "120+", tests: "3 grand tests" },
  ];
  const upscIds: string[] = [];
  for (const v of upscVolumes) {
    const row = await upsertProduct({
      slug: `upsc-foundation-volume-${v.n}`,
      title: `UPSC Foundation Volume ${v.n}: Social Science`,
      categoryId: competitive.id,
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
    upscIds.push(row.id);
  }

  const upscSet = await upsertProduct({
    slug: "upsc-foundation-set",
    title: "UPSC Foundation: Complete Set of 3 Volumes",
    kind: "BUNDLE",
    categoryId: competitive.id,
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
  for (const productId of upscIds) {
    await db.bundleItem.upsert({
      where: { bundleId_productId: { bundleId: upscSet.id, productId } },
      update: { quantity: 1 },
      create: { bundleId: upscSet.id, productId, quantity: 1 },
    });
  }

  // ── Bundles ─────────────────────────────────────────────────────────────
  // Only the pre-primary kits exist for now (owner decision, 16 Jul 2026).
  // Grade kits were removed; the admin auto-attach still works if the owner
  // ever creates a bundle with a matching grade label.
  for (const grade of ["Nursery", "LKG", "UKG"] as const) {
    await upsertProduct({
      slug: `${grade.toLowerCase()}-kit`,
      title: `${grade} Complete Kit`,
      kind: "BUNDLE",
      categoryId: bundles.id,
      series: "Baby Steps",
      gradeLabel: grade,
      description:
        `Every SLPL book your child needs for ${grade}, packed as one kit at a bundled price. ` +
        `Covers language, numbers and activity work for the full academic year. ` +
        `One order, one delivery, school-ready.`,
      mrp: 99900,
      price: 89900,
      weightGrams: 900,
      coverImage: `/seed/covers/${grade.toLowerCase()}-kit.webp`,
      isVisible: true,
    });
  }

  // ── Books imported from cover PDFs (written by scripts/import-covers-batch.ts) ─
  const importedPath = path.resolve(__dirname, "imported-books.json");
  if (existsSync(importedPath)) {
    type Imported = {
      slug: string;
      title: string;
      categorySlug: string;
      series: string;
      gradeLabel: string;
      description: string;
      coverImage: string;
      weightGrams: number;
    };
    const imported = JSON.parse(readFileSync(importedPath, "utf8")) as Imported[];
    const catBySlug: Record<string, string> = {
      "pre-primary": prePrimary.id,
      primary: primary.id,
      "high-school": highSchool.id,
    };
    for (const b of imported) {
      const product = await db.product.upsert({
        where: { slug: b.slug },
        update: { coverImage: b.coverImage, title: b.title },
        create: {
          slug: b.slug,
          title: b.title,
          kind: "BOOK",
          categoryId: catBySlug[b.categorySlug] ?? primary.id,
          series: b.series,
          gradeLabel: b.gradeLabel,
          description: b.description,
          mrp: 29900,
          price: 24900,
          stock: 100,
          weightGrams: b.weightGrams,
          coverImage: b.coverImage,
          isNewRelease: true,
          isVisible: true,
        },
      });
      // Attach to a kit only when one exists for that grade (pre-primary today)
      const kit = await db.product.findFirst({
        where: { kind: "BUNDLE", gradeLabel: b.gradeLabel },
      });
      if (kit) {
        await db.bundleItem.upsert({
          where: { bundleId_productId: { bundleId: kit.id, productId: product.id } },
          update: {},
          create: { bundleId: kit.id, productId: product.id, quantity: 1 },
        });
      }
    }
    console.log(`imported-books.json: ${imported.length} books ensured`);
  }

  // ── Services showcase ───────────────────────────────────────────────────
  const services = [
    {
      slug: "sl-radio",
      title: "SL Radio",
      tagline: "Your school's voice - live and on-demand",
      description:
        "A private internet radio station your school owns. Students and teachers go live to the whole school - announcements, news, talk shows, music - heard on any phone, computer or browser, and recorded automatically. No licence, no transmitter, no wiring.",
      bannerImage: "/banners/sl-radio.png",
      externalUrl: "https://theslpl.in",
      sortOrder: 1,
    },
    {
      slug: "english-workshops",
      title: "English Communication Workshops",
      tagline: "Every child has a voice. We help them find it.",
      description:
        "Immersive, activity-based workshops that transform hesitant learners into confident speakers - listening, speaking, reading and writing with clarity and courage. Programs for students, teacher capacity building, and school-wide communication initiatives.",
      bannerImage: "/banners/english-workshop.png",
      externalUrl: "https://theslpl.in",
      sortOrder: 2,
    },
    {
      slug: "sjis-journal",
      title: "SJIS - Saaradaa Journal of Interdisciplinary Studies",
      tagline: "Peer-reviewed, open-access, biannual (ISSN 3139-4019)",
      description:
        "A peer-reviewed multidisciplinary open-access journal publishing high-quality research across science, technology, humanities, education and more. Students and teachers can publish their work through a double-blind review process.",
      bannerImage: null,
      externalUrl: "https://journal.e2eindia.org",
      sortOrder: 3,
    },
    {
      slug: "sl-lms",
      title: "SL Learning Management System",
      tagline: "Learn smarter, not harder",
      description:
        "A complete LMS for schools - video classes, shorts, quizzes, assignments and student progress in one dashboard, linked to every SLPL textbook through QR codes.",
      bannerImage: null,
      externalUrl: "https://study.theslpl.in",
      sortOrder: 4,
    },
  ];
  for (const s of services) {
    await db.servicePage.upsert({
      where: { slug: s.slug },
      update: s,
      create: s,
    });
  }

  // ── Settings (all editable in admin; money in paise) ────────────────────
  const settings: Record<string, unknown> = {
    cod_max_order_value: 150000, // COD allowed only below ₹1,500
    bulk_otp_threshold: 500000, // email OTP required from ₹5,000
    contact_us_threshold: 2000000, // above ₹20,000 → institutional contact flow
    free_shipping_threshold: 0, // 0 = disabled
    shipping_flat_fee: 6000, // ₹60 fallback when courier API is unavailable
    origin_pincode: "500068", // Nagole, Hyderabad - confirm in admin settings
    store_notice: "",
    contact_phone: "+91 90303 90077",
    contact_email: "saradapublications18@gmail.com",
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({
      where: { key },
      update: {}, // never clobber owner-edited values on re-seed
      create: { key, value: value as object },
    });
  }

  // ── Official price catalog (SLPL Price Catalog 2026) ────────────────────
  // Applied last so it always wins over the placeholder prices above; MRP is
  // the published rate and we sell at it, so mrp and price are the same.
  const priceCatalogPath = path.resolve(__dirname, "price-catalog-2026.json");
  if (existsSync(priceCatalogPath)) {
    const catalog = JSON.parse(readFileSync(priceCatalogPath, "utf8")) as Record<string, number>;
    let priced = 0;
    for (const [slug, paise] of Object.entries(catalog)) {
      const res = await db.product.updateMany({
        where: { slug },
        data: { mrp: paise, price: paise, salePrice: null },
      });
      priced += res.count;
    }
    console.log(`price catalog: ${priced} products priced from ${Object.keys(catalog).length} entries`);
  }

  // ── Stock register codes ────────────────────────────────────────────────
  // Every title carries its master stock register code, so a school can be
  // billed for one book rather than a whole series. Books are HSN 4901 and nil
  // rated. A title the register does not cover keeps a null SKU rather than an
  // invented one, because a made-up code cannot be reconciled against the
  // physical pages.
  {
    const products = await db.product.findMany({
      select: { id: true, slug: true, title: true, series: true, gradeLabel: true, kind: true },
    });
    let coded = 0;
    let uncoded = 0;
    for (const p of products) {
      const sku = p.kind === "BUNDLE" ? null : skuFor(p);
      await db.product.update({
        where: { id: p.id },
        data: { sku, hsnCode: BOOK_HSN, gstRate: BOOK_GST_BP, unit: "BOOK" },
      });
      if (sku) coded += 1;
      else uncoded += 1;
    }
    console.log(`stock codes: ${coded} titles coded, ${uncoded} without a register code`);
  }

  // ── Kit stock is derived, never typed in ────────────────────────────────
  // A kit is assembled from its member books, so its stock is however many
  // complete sets the members can make. Inlined rather than imported from
  // src/lib/stock.ts because that module is server-only.
  {
    const kits = await db.product.findMany({
      where: { kind: "BUNDLE" },
      select: {
        id: true,
        bundleItems: { select: { quantity: true, product: { select: { stock: true } } } },
      },
    });
    for (const kit of kits) {
      if (kit.bundleItems.length === 0) continue;
      const buildable = Math.min(
        ...kit.bundleItems.map((i) => Math.floor(i.product.stock / Math.max(1, i.quantity))),
      );
      await db.product.update({ where: { id: kit.id }, data: { stock: Math.max(0, buildable) } });
    }
    console.log(`kit stock: recomputed for ${kits.length} bundle(s)`);
  }

  const counts = {
    categories: await db.category.count(),
    products: await db.product.count(),
    bundles: await db.product.count({ where: { kind: "BUNDLE" } }),
    services: await db.servicePage.count(),
    settings: await db.setting.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
