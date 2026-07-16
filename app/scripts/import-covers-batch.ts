/**
 * Batch import of the 2026-07-16 WhatsApp cover-PDF drop.
 *
 * Every page in these PDFs is a printed cover SPREAD: back cover on the left,
 * front cover on the right (sometimes with a spine strip between). This
 * script renders each mapped page, crops the front panel in high resolution,
 * mines the back-cover "About This Book" text for the description, creates
 * the product with dummy prices, ensures a grade kit exists and attaches the
 * book to it. It also writes prisma/imported-books.json so `prisma db seed`
 * creates the same catalog on the server.
 *
 * Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/import-covers-batch.ts
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PDF_DIR = path.resolve(
  __dirname,
  "../../assets/cover_pdfs/WhatsApp Unknown 2026-07-16 at 9.15.06 AM",
);
const OUT_DIR = path.resolve(__dirname, "../public/seed/covers/subjects");
const TMP = path.resolve(__dirname, "../.import-tmp");
const DPI = 150;

// Crop families: front-panel width in PDF points.
// A: grades 1-5 + pre-primary spreads (~1233x807, front 616.5pt)
// B: grades 6-10 A4 spreads (~1210x842, front 595pt)
// WIDE: landscape drawing-book wraps (front = right 47%)
// FULL: the whole page IS the front
type Crop = "A" | "B" | "WIDE" | "FULL";

type Entry = {
  file: string;
  page: number;
  slug: string;
  title: string;
  grade: string; // gradeLabel ("Nursery" | "LKG" | "UKG" | "Grade N")
  subject: string;
  crop: Crop;
  landscape?: boolean;
};

const M = (
  file: string,
  page: number,
  slug: string,
  title: string,
  grade: string,
  subject: string,
  crop: Crop,
  landscape = false,
): Entry => ({ file, page, slug, title, grade, subject, crop, landscape });

const manifest: Entry[] = [
  // ── Nursery (Baby Steps 1) ──
  M("New English CP 2026 NURSERY.pdf", 1, "nursery-english-coursebook", "English Course Book, Nursery", "Nursery", "English", "A"),
  M("New Nursery CP EVS CB 2026 WITH SPINE.pdf", 1, "nursery-evs-coursebook", "EVS Course Book, Nursery", "Nursery", "EVS", "A"),
  M("NEW Nursery Maths CB Cp 2026.pdf", 1, "nursery-maths-coursebook", "Maths Course Book, Nursery", "Nursery", "Math", "A"),
  M("NEW NURSERY DRAWING TITLE PAGE.pdf", 1, "nursery-drawing", "First Artist in Me: Drawing and Coloring Book, Nursery", "Nursery", "Drawing", "FULL", true),
  M("NURSERY 2026 SECOND EDITION NO SPINE COVER PAGES.pdf", 1, "nursery-english-workbook", "My First Letters: English Work Book, Nursery", "Nursery", "English", "A"),
  M("NURSERY 2026 SECOND EDITION NO SPINE COVER PAGES.pdf", 2, "nursery-numbers-workbook", "My First Numbers: Maths Work Book, Nursery", "Nursery", "Math", "A"),
  M("NURSERY 2026 SECOND EDITION NO SPINE COVER PAGES.pdf", 3, "nursery-rhymes", "Nursery Rhymes and Songs", "Nursery", "Rhymes", "A"),
  M("NURSERY 2026 SECOND EDITION NO SPINE COVER PAGES.pdf", 4, "nursery-evs-workbook", "My First Environment: EVS Work Book, Nursery", "Nursery", "EVS", "A"),
  M("NURSERY 2026 SECOND EDITION NO SPINE COVER PAGES.pdf", 5, "nursery-lines-patterns", "Lines and Patterns Activity Book, Nursery", "Nursery", "Lines and Patterns", "A"),
  M("NURSERY 2026 SECOND EDITION NO SPINE COVER PAGES.pdf", 6, "nursery-telugu", "Naa Modati Aksharamala: Telugu, Nursery", "Nursery", "Telugu", "A"),

  // ── LKG (Baby Steps 2) ──
  M("LKG ENGLISH COURSE BOOKCOVER PAGE WITH SPINE.pdf", 1, "lkg-english-coursebook", "English Course Book, LKG", "LKG", "English", "A"),
  M("LKG EVS COURSEBOOK COVER PAGE.pdf", 1, "lkg-evs-coursebook", "EVS Course Book, LKG", "LKG", "EVS", "A"),
  M("LKG MATHS COVER PAGE COURSEBOOK.pdf", 1, "lkg-maths-coursebook", "Maths Course Book, LKG", "LKG", "Math", "A"),
  M("LKG FINAL DRAWING COVER PAGE.pdf", 1, "lkg-drawing", "Drawing and Coloring Book, LKG", "LKG", "Drawing", "WIDE", true),
  M("LKG FINAL NO SPINE COVER PAGES.pdf", 1, "lkg-rhymes", "Sing, Read and Smile: Rhymes, LKG", "LKG", "Rhymes", "A"),
  M("LKG FINAL NO SPINE COVER PAGES.pdf", 2, "lkg-lines-patterns", "Lines and Patterns, LKG", "LKG", "Lines and Patterns", "A"),
  M("LKG FINAL NO SPINE COVER PAGES.pdf", 3, "lkg-telugu", "Naa Aksharamala: Telugu, LKG", "LKG", "Telugu", "A"),
  M("LKG FINAL NO SPINE COVER PAGES.pdf", 4, "lkg-hindi", "Hindi Akshar Gyan, LKG", "LKG", "Hindi", "A"),
  M("LKG FINAL NO SPINE COVER PAGES.pdf", 5, "lkg-evs-workbook", "Let's Know Our World: EVS Work Book, LKG", "LKG", "EVS", "A"),
  M("LKG FINAL NO SPINE COVER PAGES.pdf", 6, "lkg-english-workbook", "Let's Learn Letters and Words: English Work Book, LKG", "LKG", "English", "A"),
  M("LKG FINAL NO SPINE COVER PAGES.pdf", 7, "lkg-maths-workbook", "Math Genius: Number Practice Work Book, LKG", "LKG", "Math", "A"),

  // ── UKG (Baby Steps 3) ──
  M("UKG COVER PAGES WITH SPINES 2026 SECODN EDITION.pdf", 1, "ukg-english-coursebook", "I Can Read and Write: English Course Book, UKG", "UKG", "English", "A"),
  M("UKG COVER PAGES WITH SPINES 2026 SECODN EDITION.pdf", 2, "ukg-evs-coursebook", "I Know About My World: EVS Course Book, UKG", "UKG", "EVS", "A"),
  M("UKG DRAWING BOOK COVER PAGE.pdf", 1, "ukg-drawing", "Drawing Book, UKG", "UKG", "Drawing", "WIDE", true),
  M("UKG FINAL COVER PAGES 2026 SECOND EDITION.pdf", 1, "ukg-evs-workbook", "My Activity and Discovery Book: EVS Work Book, UKG", "UKG", "EVS", "A"),
  M("UKG FINAL COVER PAGES 2026 SECOND EDITION.pdf", 2, "ukg-rhymes", "Stories and Songs I Love, UKG", "UKG", "Rhymes", "A"),
  M("UKG FINAL COVER PAGES 2026 SECOND EDITION.pdf", 3, "ukg-hindi", "Hindi Shabd Gyan, UKG", "UKG", "Hindi", "A"),
  M("UKG FINAL COVER PAGES 2026 SECOND EDITION.pdf", 4, "ukg-telugu", "Telugu Naa Aksharamala, UKG", "UKG", "Telugu", "A"),
  M("UKG FINAL COVER PAGES 2026 SECOND EDITION.pdf", 5, "ukg-english-workbook", "My English Practice World: Work Book, UKG", "UKG", "English", "A"),
  M("UKG FINAL COVER PAGES 2026 SECOND EDITION.pdf", 6, "ukg-maths-workbook", "My Maths Practice World: Work Book, UKG", "UKG", "Math", "A"),
  M("UKG FINAL COVER PAGES 2026 SECOND EDITION.pdf", 7, "ukg-maths-coursebook", "I Can Count and Think: Maths Course Book, UKG", "UKG", "Math", "A"),

  // ── Grade 1 (new subjects only; the six existing repeat in this drop) ──
  M("Grade 1 COVER PAGES WITH SPINE.pdf", 1, "little-leaps-grade1-math", "Little Leaps Math, Grade 1", "Grade 1", "Math", "A"),
  M("Grade 1 COVER PAGES WITH SPINE.pdf", 2, "little-leaps-grade1-science", "Little Leaps Science, Grade 1", "Grade 1", "Science", "A"),

  // ── Grade 2 (Maths already exists from yesterday; skipped) ──
  M("Grade 2 COVER PAGES WITHOUT SPINE.pdf", 1, "little-leaps-grade2-computer", "Little Leaps Computer, Grade 2", "Grade 2", "Computer", "A"),
  M("Grade 2 COVER PAGES WITHOUT SPINE.pdf", 2, "little-leaps-grade2-gk", "Little Leaps General Knowledge, Grade 2", "Grade 2", "GK", "A"),
  M("Grade 2 COVER PAGES WITHOUT SPINE.pdf", 3, "little-leaps-grade2-telugu", "Little Leaps Telugu, Grade 2", "Grade 2", "Telugu", "A"),
  M("Grade 2 COVER PAGES WITHOUT SPINE.pdf", 4, "little-leaps-grade2-hindi", "Little Leaps Hindi, Grade 2", "Grade 2", "Hindi", "A"),
  M("Grade 2 COVER PAGES WITHOUT SPINE.pdf", 5, "little-leaps-grade2-english", "Little Leaps English, Grade 2", "Grade 2", "English", "A"),
  M("Grade 2 science cover page.pdf", 1, "little-leaps-grade2-science", "Little Leaps Science, Grade 2", "Grade 2", "Science", "A"),
  M("GRADE 2 SOCIAL STUDIES COVER PAGE.pdf", 1, "little-leaps-grade2-social", "Little Leaps Social Studies, Grade 2", "Grade 2", "Social", "A"),

  // ── Grade 3 ──
  M("Grade 3 cover pages with spine maths science.pdf", 1, "little-leaps-grade3-math", "Little Leaps Math, Grade 3", "Grade 3", "Math", "A"),
  M("Grade 3 cover pages with spine maths science.pdf", 2, "little-leaps-grade3-science", "Little Leaps Science, Grade 3", "Grade 3", "Science", "A"),
  M("Grade 3 Cover Pages with Spine.pdf", 1, "little-leaps-grade3-telugu", "Little Leaps Telugu, Grade 3", "Grade 3", "Telugu", "A"),
  M("Grade 3 Cover Pages with Spine.pdf", 2, "little-leaps-grade3-english", "Little Leaps English, Grade 3", "Grade 3", "English", "A"),
  M("Grade 3 Cover Pages with Spine.pdf", 3, "little-leaps-grade3-social", "Little Leaps Social Studies, Grade 3", "Grade 3", "Social", "A"),

  // ── Grade 4 ──
  M("GRADE 4 COVER PAGES WITH SPINE.pdf", 1, "little-leaps-grade4-english", "Little Leaps English, Grade 4", "Grade 4", "English", "A"),
  M("GRADE 4 COVER PAGES WITH SPINE.pdf", 2, "little-leaps-grade4-social", "Little Leaps Social Studies, Grade 4", "Grade 4", "Social", "A"),
  M("GRADE 4 COVER PAGES WITH SPINE.pdf", 3, "little-leaps-grade4-science", "Little Leaps Science, Grade 4", "Grade 4", "Science", "A"),
  M("GRADE 4 HINDI COVER PAGE.pdf", 1, "little-leaps-grade4-hindi", "Little Leaps Hindi, Grade 4", "Grade 4", "Hindi", "A"),
  M("GRADE 4 MATHS COVER PAGE.pdf", 1, "little-leaps-grade4-math", "Little Leaps Math, Grade 4", "Grade 4", "Math", "A"),

  // ── Grade 5 ──
  M("GARDE 5 MATHS COVER PAGE.pdf", 1, "little-leaps-grade5-math", "Little Leaps Math, Grade 5", "Grade 5", "Math", "A"),
  M("Grade 5 COVER PAGES WITHOUT SPINE.pdf", 1, "little-leaps-grade5-computer", "Little Leaps Computer, Grade 5", "Grade 5", "Computer", "A"),
  M("Grade 5 COVER PAGES WITHOUT SPINE.pdf", 2, "little-leaps-grade5-gk", "Little Leaps General Knowledge, Grade 5", "Grade 5", "GK", "A"),
  M("GRADE 5 COVER PAGES WITH SPINE.pdf", 1, "little-leaps-grade5-science", "Little Leaps Science, Grade 5", "Grade 5", "Science", "A"),
  M("GRADE 5 COVER PAGES WITH SPINE.pdf", 2, "little-leaps-grade5-hindi", "Little Leaps Hindi, Grade 5", "Grade 5", "Hindi", "A"),
  M("GRADE 5 COVER PAGES WITH SPINES ENGLISH, SOCIAL.pdf", 1, "little-leaps-grade5-english", "Little Leaps English, Grade 5", "Grade 5", "English", "A"),
  M("GRADE 5 COVER PAGES WITH SPINES ENGLISH, SOCIAL.pdf", 2, "little-leaps-grade5-social", "Little Leaps Social Studies, Grade 5", "Grade 5", "Social", "A"),
  M("Grade 5 Telugu Cover Page.pdf", 1, "little-leaps-grade5-telugu", "Little Leaps Telugu, Grade 5", "Grade 5", "Telugu", "A"),

  // ── Grades 6-10 (Skill Builders) ──
  M("6th grade science cover page.pdf", 1, "skill-builders-grade6-science", "Skill Builders Science, Grade 6", "Grade 6", "Science", "B"),
  M("6th grade Social Term 1 Cover Page.pdf", 1, "skill-builders-grade6-social", "Skill Builders Social Studies, Grade 6", "Grade 6", "Social", "B"),
  M("GRADE 6 ENGLISH COVER PAGE.pdf", 1, "skill-builders-grade6-english", "Skill Builders English, Grade 6", "Grade 6", "English", "B"),
  M("Grade 6 Maths Cover Page.pdf", 1, "skill-builders-grade6-math", "Skill Builders Math, Grade 6", "Grade 6", "Math", "B"),
  M("7th grade Social Term 1 Cover Page.pdf", 1, "skill-builders-grade7-social", "Skill Builders Social Studies, Grade 7", "Grade 7", "Social", "B"),
  M("GRADE 7 ENGLISH COVER PAGE.pdf", 1, "skill-builders-grade7-english", "Skill Builders English, Grade 7", "Grade 7", "English", "B"),
  M("Grade 7  Maths Cover Page Term 1.pdf", 1, "skill-builders-grade7-math", "Skill Builders Math, Grade 7", "Grade 7", "Math", "B"),
  M("GRADE 7 SCEINCE COVER PAGE.pdf", 1, "skill-builders-grade7-science", "Skill Builders Science, Grade 7", "Grade 7", "Science", "B"),
  M("grade 8 biology cover page term 1.pdf", 1, "skill-builders-grade8-biology", "Skill Builders Biology, Grade 8", "Grade 8", "Biology", "B"),
  M("GRADE 8 ENGLISH COVER PAGE.pdf", 1, "skill-builders-grade8-english", "Skill Builders English, Grade 8", "Grade 8", "English", "B"),
  M("Grade 8  Maths Cover Page Term 1.pdf", 1, "skill-builders-grade8-math", "Skill Builders Math, Grade 8", "Grade 8", "Math", "B"),
  M("grade 8 physics cover page term 1.pdf", 1, "skill-builders-grade8-physics", "Skill Builders Physics, Grade 8", "Grade 8", "Physics", "B"),
  M("grade 8 social coevr page .pdf", 1, "skill-builders-grade8-social", "Skill Builders Social Studies, Grade 8", "Grade 8", "Social", "B"),
  M("9th grade Geography Term 1 Cover Page.pdf", 1, "skill-builders-grade9-geography", "Skill Builders Geography and History, Grade 9", "Grade 9", "Geography", "B"),
  M("Grade 9 Biology Cover Page Term 1.pdf", 1, "skill-builders-grade9-biology", "Skill Builders Biology, Grade 9", "Grade 9", "Biology", "B"),
  M("GRADE 9 ENGLISH COVER PAGE.pdf", 1, "skill-builders-grade9-english", "Skill Builders English, Grade 9", "Grade 9", "English", "B"),
  M("Grade 9  Maths Cover Page Term 1.pdf", 1, "skill-builders-grade9-math", "Skill Builders Math, Grade 9", "Grade 9", "Math", "B"),
  M("grade 9 physics cover page term 1.pdf", 1, "skill-builders-grade9-physics", "Skill Builders Physics, Grade 9", "Grade 9", "Physics", "B"),
  M("Grade 10 Biology Cover Page Term 1.pdf", 1, "skill-builders-grade10-biology", "Skill Builders Biology, Grade 10", "Grade 10", "Biology", "B"),
  M("GRADE 10 ENGLISH COVER PAGE.pdf", 1, "skill-builders-grade10-english", "Skill Builders English, Grade 10", "Grade 10", "English", "B"),
  M("Grade 10  Maths Cover Page Term 1.pdf", 1, "skill-builders-grade10-math", "Skill Builders Math, Grade 10", "Grade 10", "Math", "B"),
  M("grade 10 Physics cover page.pdf", 1, "skill-builders-grade10-physics", "Skill Builders Physics, Grade 10", "Grade 10", "Physics", "B"),
  M("grade 10 social coevr page .pdf", 1, "skill-builders-grade10-social", "Skill Builders Social Studies, Grade 10", "Grade 10", "Social", "B"),
];

const BLURB: Record<string, string> = {
  English: "reading, phonics, grammar-in-use and confident speaking",
  Telugu: "varnamala, padalu, reading fluency and handwriting practice",
  Hindi: "varnmala, matras, vocabulary and simple sentence practice",
  Math: "numbers, operations, shapes and everyday problem solving",
  Computer: "computer basics, digital habits and hands-on activities",
  GK: "the world around us, current awareness and thinking questions",
  Social: "people, places, our country and community life",
  Science: "observation, experiments and the science of everyday life",
  EVS: "environment, nature and our place in the living world",
  Rhymes: "songs, actions and joyful first words",
  Drawing: "colours, strokes and creative expression",
  "Lines and Patterns": "pre-writing strokes, patterns and fine motor skills",
  Biology: "life processes, the human body and the living world",
  Physics: "motion, energy and how the physical world works",
  Geography: "maps, landscapes and how people live on our planet",
};

function pageText(pdf: string, page: number): string {
  try {
    const raw = execFileSync("pdftotext", ["-f", String(page), "-l", String(page), pdf, "-"], {
      encoding: "utf8",
    });
    // Prefer the "About This Book" back-cover blurb when present
    const about = raw.match(/About This Book\s*([\s\S]{50,700}?)(?:Children will learn|SAARADAA|Inside this book|What your child|$)/i);
    const text = (about?.[1] ?? "").replace(/\s+/g, " ").trim();
    return text.slice(0, 420);
  } catch {
    return "";
  }
}

function seriesFor(grade: string): string {
  if (grade === "Nursery") return "Baby Steps 1";
  if (grade === "LKG") return "Baby Steps 2";
  if (grade === "UKG") return "Baby Steps 3";
  const n = Number(grade.replace("Grade ", ""));
  return n <= 5 ? "Little Leaps" : "Skill Builders";
}

function categorySlugFor(grade: string): string {
  if (["Nursery", "LKG", "UKG"].includes(grade)) return "pre-primary";
  const n = Number(grade.replace("Grade ", ""));
  return n <= 5 ? "primary" : "high-school";
}

async function ensureKit(grade: string, bundlesCategoryId: string): Promise<string> {
  const slug = `${grade.toLowerCase().replace(/\s/g, "-")}-kit`;
  const series = seriesFor(grade).startsWith("Baby Steps") ? "Baby Steps" : seriesFor(grade);
  const kit = await db.product.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      title: `${grade} Complete Kit`,
      kind: "BUNDLE",
      categoryId: bundlesCategoryId,
      series,
      gradeLabel: grade,
      description:
        `The full ${series} set for ${grade} in one box: every subject, one bundled price. ` +
        `Cheaper than buying the books one by one, and everything arrives together, school-ready. ` +
        `More titles join this kit as they are released.`,
      mrp: 99900,
      price: 89900,
      weightGrams: 1200,
      isVisible: false,
    },
  });
  return kit.id;
}

async function main() {
  // SKIP_DB=1 renders covers + writes the JSON only; `prisma db seed`
  // consumes the JSON later (useful when the DB tunnel is down).
  const skipDb = process.env.SKIP_DB === "1";
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const categories: Record<string, string> = skipDb
    ? {}
    : Object.fromEntries(
        (await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
      );

  const exported: object[] = [];
  let done = 0;
  for (const e of manifest) {
    const pdfPath = path.join(PDF_DIR, e.file);
    const base = path.join(TMP, e.slug);
    execFileSync("pdftoppm", ["-png", "-r", String(DPI), "-f", String(e.page), "-l", String(e.page), pdfPath, base]);
    const produced = readdirSync(TMP).find((f) => f.startsWith(`${e.slug}-`));
    if (!produced) throw new Error(`no page rendered for ${e.slug}`);
    const full = path.join(TMP, `${e.slug}-full.png`);
    renameSync(path.join(TMP, produced), full);

    const img = sharp(full);
    const meta = await img.metadata();
    const W = meta.width!;
    const H = meta.height!;
    let cropW = W;
    if (e.crop === "A") cropW = Math.round((616.5 / 72) * DPI);
    else if (e.crop === "B") cropW = Math.round((595 / 72) * DPI);
    else if (e.crop === "WIDE") cropW = Math.round(W * 0.47);
    cropW = Math.min(cropW, W);

    const outName = `${e.slug}.webp`;
    await sharp(full)
      .extract({ left: W - cropW, top: 0, width: cropW, height: H })
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(path.join(OUT_DIR, outName));

    const back = pageText(pdfPath, e.page);
    const series = seriesFor(e.grade);
    const description =
      (back ? `${back} ` : `The ${series} ${e.subject} book for ${e.grade}, covering ${BLURB[e.subject] ?? "the year's syllabus"}. `) +
      `Full-colour pages designed by the SLPL curriculum team. Part of the complete ${series} set for ${e.grade}.`;

    const record = {
      slug: e.slug,
      title: e.title,
      categorySlug: categorySlugFor(e.grade),
      series,
      gradeLabel: e.grade,
      description,
      coverImage: `/seed/covers/subjects/${outName}`,
      weightGrams: e.subject === "Drawing" ? 250 : 350,
      landscape: e.landscape ?? false,
    };
    exported.push(record);

    if (skipDb) {
      done++;
      if (done % 10 === 0) console.log(`${done}/${manifest.length}…`);
      continue;
    }

    // Upsert in the current database too (dev convenience)
    const product = await db.product.upsert({
      where: { slug: e.slug },
      update: { coverImage: record.coverImage, description, title: e.title },
      create: {
        slug: e.slug,
        title: e.title,
        kind: "BOOK",
        categoryId: categories[record.categorySlug],
        series,
        gradeLabel: e.grade,
        description,
        mrp: 29900,
        price: 24900,
        stock: 100,
        weightGrams: record.weightGrams,
        coverImage: record.coverImage,
        isNewRelease: true,
        isVisible: true,
      },
    });
    const kitId = await ensureKit(e.grade, categories["bundles"]);
    await db.bundleItem.upsert({
      where: { bundleId_productId: { bundleId: kitId, productId: product.id } },
      update: {},
      create: { bundleId: kitId, productId: product.id, quantity: 1 },
    });
    await db.product.update({ where: { id: kitId }, data: { isVisible: true } });
    done++;
    if (done % 10 === 0) console.log(`${done}/${manifest.length}…`);
  }

  writeFileSync(
    path.resolve(__dirname, "../prisma/imported-books.json"),
    JSON.stringify(exported, null, 2),
  );
  rmSync(TMP, { recursive: true, force: true });
  console.log(`imported ${done} books; manifest written to prisma/imported-books.json`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
