/**
 * Seed the SLPL Store catalog.
 *
 * Idempotent (upserts by slug/key) — safe to re-run.
 * Every product starts isVisible=false: the owner sets real prices in the
 * admin panel and flips visibility when ready. Prices below are placeholders
 * in paise (₹349 = 34900).
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const covers = [
  "/seed/covers/img3.jpeg",
  "/seed/covers/img11.jpg",
  "/seed/covers/img12.jpg",
  "/seed/covers/img13.jpg",
  "/seed/covers/img14.jpg",
  "/seed/covers/img17.jpeg",
  "/seed/covers/img18.jpeg",
  "/seed/covers/img4.png",
];
const cover = (i: number) => covers[i % covers.length];

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
    "Baby Steps series for Nursery, LKG and UKG — a joyful first step into letters, numbers and the world around.",
    1,
  );
  const primary = await upsertCategory(
    "primary",
    "Primary",
    "Little Leaps series for Grades 1–5 — concept-first learning aligned with state and national curricula.",
    2,
  );
  const highSchool = await upsertCategory(
    "high-school",
    "High School",
    "Skill Builders series for Grades 6–10 — rigorous practice modules that bridge school syllabus and competitive readiness.",
    3,
  );
  const seniorSec = await upsertCategory(
    "senior-secondary",
    "Senior Secondary",
    "Focused material for Grades 11–12 — clarity, depth and exam-ready practice.",
    4,
  );
  const novelsPoems = await upsertCategory(
    "novels-poems",
    "Novels & Poems",
    "Stories and verse from SLPL — reading that builds language and character.",
    5,
  );
  const bundles = await upsertCategory(
    "bundles",
    "Class Bundles",
    "Everything a class needs in one box — complete book sets at a bundled price.",
    6,
  );

  // ── Baby Steps (Pre-Primary ×3) ─────────────────────────────────────────
  const babySteps: ProductSeed[] = (
    [
      ["nursery", "Nursery", "first lines and strokes, colours, shapes, rhymes and number play"],
      ["lkg", "LKG", "letter formation, phonic sounds, numbers to 50, patterns and picture talk"],
      ["ukg", "UKG", "reading simple words, writing practice, numbers to 100 and early addition"],
    ] as const
  ).map(([slug, grade, focus], i) => ({
    slug: `baby-steps-${slug}`,
    title: `Baby Steps — ${grade}`,
    categoryId: prePrimary.id,
    series: "Baby Steps",
    gradeLabel: grade,
    description:
      `A joyful, activity-first workbook for ${grade} covering ${focus}. ` +
      `Large friendly type, colour illustrations on every page, and tear-free thick paper made for small hands. ` +
      `Each unit ends with a fun "show what you know" activity parents can do with the child. ` +
      `Developed by the SLPL curriculum team and refined through classroom use in partner schools.`,
    mrp: 34900,
    price: 29900,
    weightGrams: 300,
    coverImage: cover(i),
  }));

  // ── Little Leaps (Grades 1–5 ×5) ────────────────────────────────────────
  const littleLeaps: ProductSeed[] = [1, 2, 3, 4, 5].map((g, i) => ({
    slug: `little-leaps-grade-${g}`,
    title: `Little Leaps — Grade ${g}`,
    categoryId: primary.id,
    series: "Little Leaps",
    gradeLabel: `Grade ${g}`,
    description:
      `The complete Little Leaps companion for Grade ${g} — concepts explained the way children actually think. ` +
      `Every chapter moves from a real-life hook to guided examples to independent practice, with skill-check boxes throughout. ` +
      `Includes term-wise revision maps and QR-linked concept videos on the SLPL LMS. ` +
      `Progressively revised to suit heterogeneous learners at state and national levels.`,
    mrp: 39900,
    price: 34900,
    weightGrams: 400,
    coverImage: cover(i + 3),
    isNewRelease: g === 5,
  }));

  // ── Skill Builders (Grades 6–10 ×5) ─────────────────────────────────────
  const skillBuilders: ProductSeed[] = [6, 7, 8, 9, 10].map((g, i) => ({
    slug: `skill-builders-grade-${g}`,
    title: `Skill Builders — Grade ${g}`,
    categoryId: highSchool.id,
    series: "Skill Builders",
    gradeLabel: `Grade ${g}`,
    description:
      `Skill Builders for Grade ${g} turns the syllabus into mastery — module-wise practice that fills the gap between textbook and exam hall. ` +
      `Graded exercise sets (basic → standard → challenge), previous-year style questions and UPSC-pattern concept probes. ` +
      `Answer keys with worked solutions help students self-correct, not just check. ` +
      `Trusted by partner schools across Telangana and Andhra Pradesh.`,
    mrp: 44900,
    price: 39900,
    weightGrams: 450,
    coverImage: cover(i + 1),
    samplePdf: `/seed/samples/skill-builders-${g}.pdf`,
    isNewRelease: g === 10,
  }));

  // ── Novels & Poems ──────────────────────────────────────────────────────
  const novel: ProductSeed = {
    slug: "life-of-student",
    title: "Life of Student",
    kind: "NOVEL",
    categoryId: novelsPoems.id,
    description:
      `A heartfelt novel that walks through the everyday battles of a student — friendships, failures, marks, dreams and the quiet courage it takes to keep going. ` +
      `Written in simple, honest prose that young readers see themselves in. ` +
      `A book meant to be passed from one school bag to another. ` +
      `From the SLPL publishing house.`,
    mrp: 29900,
    price: 24900,
    weightGrams: 250,
    coverImage: "/seed/covers/life-of-student.jpg",
    isNewRelease: true,
    isFeatured: true,
  };

  const poems: ProductSeed = {
    slug: "poems-collection-vol-1",
    title: "SLPL Poems Collection — Volume 1",
    kind: "POEMS",
    categoryId: novelsPoems.id,
    description:
      `A curated collection of poems for young readers — rhythm, wonder and values in verses short enough to memorise and deep enough to discuss. ` +
      `Ideal for recitation practice, morning assemblies and quiet reading alike. ` +
      `Includes a reading guide for teachers and parents.`,
    mrp: 19900,
    price: 17900,
    weightGrams: 200,
    coverImage: cover(5),
    isNewRelease: true,
  };

  const allBooks = [...babySteps, ...littleLeaps, ...skillBuilders, novel, poems];
  const created: Record<string, { id: string; price: number }> = {};
  for (const p of allBooks) {
    const row = await upsertProduct(p);
    created[p.slug] = { id: row.id, price: row.price };
  }

  // ── Bundles (placeholder members — owner attaches the real set in admin) ─
  const bundleDefs = [
    { slug: "nursery-kit", grade: "Nursery", member: "baby-steps-nursery" },
    { slug: "lkg-kit", grade: "LKG", member: "baby-steps-lkg" },
    { slug: "ukg-kit", grade: "UKG", member: "baby-steps-ukg" },
  ] as const;

  for (const [i, b] of bundleDefs.entries()) {
    const member = created[b.member];
    const bundle = await upsertProduct({
      slug: b.slug,
      title: `${b.grade} Complete Kit`,
      kind: "BUNDLE",
      categoryId: bundles.id,
      series: "Baby Steps",
      gradeLabel: b.grade,
      description:
        `Every SLPL book your child needs for ${b.grade}, packed as one kit at a bundled price. ` +
        `Covers language, numbers and activity work for the full academic year. ` +
        `One order, one delivery, school-ready. ` +
        `(Kit contents are being finalised — the list below will grow.)`,
      mrp: 34900,
      price: Math.round((member.price * 0.9) / 100) * 100, // 10% under member total, rounded to a rupee
      weightGrams: 900,
      coverImage: cover(i + 6),
    });
    await db.bundleItem.upsert({
      where: { bundleId_productId: { bundleId: bundle.id, productId: member.id } },
      update: { quantity: 1 },
      create: { bundleId: bundle.id, productId: member.id, quantity: 1 },
    });
  }

  // ── Services showcase ───────────────────────────────────────────────────
  const services = [
    {
      slug: "sl-radio",
      title: "SL Radio",
      tagline: "Your school's voice — live and on-demand",
      description:
        "A private internet radio station your school owns. Students and teachers go live to the whole school — announcements, news, talk shows, music — heard on any phone, computer or browser, and recorded automatically. No licence, no transmitter, no wiring.",
      bannerImage: "/banners/sl-radio.png",
      externalUrl: "https://theslpl.in",
      sortOrder: 1,
    },
    {
      slug: "english-workshops",
      title: "English Communication Workshops",
      tagline: "Every child has a voice. We help them find it.",
      description:
        "Immersive, activity-based workshops that transform hesitant learners into confident speakers — listening, speaking, reading and writing with clarity and courage. Programs for students, teacher capacity building, and school-wide communication initiatives.",
      bannerImage: "/banners/english-workshop.png",
      externalUrl: "https://theslpl.in",
      sortOrder: 2,
    },
    {
      slug: "sjis-journal",
      title: "SJIS — Saaradaa Journal of Interdisciplinary Studies",
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
        "A complete LMS for schools — video classes, shorts, quizzes, assignments and student progress in one dashboard, linked to every SLPL textbook through QR codes.",
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
    origin_pincode: "500068", // Nagole, Hyderabad — confirm in admin settings
    store_notice: "",
    contact_phone: "+91 79891 91962",
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
