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
  const seniorSec = await upsertCategory(
    "senior-secondary",
    "Senior Secondary",
    "Focused material for Grades 11-12 - clarity, depth and exam-ready practice.",
    4,
  );
  const novelsPoems = await upsertCategory(
    "novels-poems",
    "Novels & Poems",
    "Stories and verse from SLPL - reading that builds language and character.",
    5,
  );
  const bundles = await upsertCategory(
    "bundles",
    "Class Bundles",
    "Everything a class needs in one box - complete book sets at a bundled price.",
    6,
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

  const allBooks = [...subjectBooks, novel];
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

  // ── Bundles ─────────────────────────────────────────────────────────────
  // Pre-primary kits stay hidden until the owner uploads their images.
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
      isVisible: false,
    });
  }

  // Grade kits hold every subject book of that grade. Books added later in
  // the admin panel attach to their grade kit automatically.
  for (const grade of [1, 2, 3, 4, 5]) {
    const label = `Grade ${grade}`;
    const members = Object.entries(created).filter(([slug]) =>
      slug.startsWith(`little-leaps-grade${grade}-`),
    );
    const memberTotal = members.reduce((sum, [, m]) => sum + m.price, 0);
    const kit = await upsertProduct({
      slug: `grade-${grade}-kit`,
      title: `${label} Complete Kit`,
      kind: "BUNDLE",
      categoryId: bundles.id,
      series: "Little Leaps",
      gradeLabel: label,
      description:
        `The full Little Leaps set for ${label} in one box: every subject, one bundled price. ` +
        `Cheaper than buying the books one by one, and everything arrives together, school-ready. ` +
        `More titles join this kit as they are released.`,
      mrp: memberTotal > 0 ? memberTotal : 99900,
      price: memberTotal > 0 ? Math.round((memberTotal * 0.9) / 100) * 100 : 89900,
      weightGrams: Math.max(400, members.length * 350),
      isVisible: members.length > 0,
    });
    for (const [, m] of members) {
      await db.bundleItem.upsert({
        where: { bundleId_productId: { bundleId: kit.id, productId: m.id } },
        update: { quantity: 1 },
        create: { bundleId: kit.id, productId: m.id, quantity: 1 },
      });
    }
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
      const kitSlug = `${b.gradeLabel.toLowerCase().replace(/\s/g, "-")}-kit`;
      const kit = await db.product.upsert({
        where: { slug: kitSlug },
        update: {},
        create: {
          slug: kitSlug,
          title: `${b.gradeLabel} Complete Kit`,
          kind: "BUNDLE",
          categoryId: bundles.id,
          series: b.series.startsWith("Baby Steps") ? "Baby Steps" : b.series,
          gradeLabel: b.gradeLabel,
          description:
            `The full ${b.series} set for ${b.gradeLabel} in one box: every subject, one bundled price. ` +
            `Cheaper than buying the books one by one, and everything arrives together, school-ready.`,
          mrp: 99900,
          price: 89900,
          weightGrams: 1200,
          isVisible: false,
        },
      });
      await db.bundleItem.upsert({
        where: { bundleId_productId: { bundleId: kit.id, productId: product.id } },
        update: {},
        create: { bundleId: kit.id, productId: product.id, quantity: 1 },
      });
      await db.product.update({ where: { id: kit.id }, data: { isVisible: true } });
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
