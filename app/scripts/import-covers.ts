/**
 * Import book cover PDFs into the catalog.
 *
 * Drop PDFs into assets/cover_pdfs/ named so the grade and subject are
 * recognisable, e.g. Grade1_English.pdf, Telugu_Grade3.pdf, UKG_Rhymes.pdf.
 * For each PDF this script:
 *   1. parses grade + subject from the filename
 *   2. skips it if that grade+subject book already exists (yesterday's
 *      covers repeat sometimes; existing books win)
 *   3. renders page 1 (front cover) at high resolution into
 *      public/seed/covers/subjects/
 *   4. reads page 2 (back cover) text and folds it into the description
 *   5. creates the product with dummy prices and attaches it to its grade kit
 *
 * Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/import-covers.ts
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PDF_DIR = path.resolve(__dirname, "../../assets/cover_pdfs");
const OUT_DIR = path.resolve(__dirname, "../public/seed/covers/subjects");

const SUBJECTS: Record<string, string> = {
  english: "English",
  telugu: "Telugu",
  hindi: "Hindi",
  math: "Math",
  maths: "Math",
  mathematics: "Math",
  gk: "GK",
  generalknowledge: "GK",
  computer: "Computer",
  computers: "Computer",
  social: "Social",
  science: "Science",
  evs: "EVS",
  moral: "Moral Science",
  rhymes: "Rhymes",
  drawing: "Drawing",
};

const BLURB: Record<string, string> = {
  English: "reading, phonics, grammar-in-use and confident speaking",
  Telugu: "varnamala, padalu, reading fluency and handwriting practice",
  Hindi: "varnmala, matras, vocabulary and simple sentence practice",
  Math: "numbers, operations, shapes and everyday problem solving",
  Computer: "computer basics, digital habits and hands-on activities",
  GK: "the world around us, current awareness and thinking questions",
  Social: "family, neighbourhood, our country and community life",
  Science: "observation, experiments and the science of everyday life",
  EVS: "environment, nature and our place in the living world",
  "Moral Science": "values, empathy and good habits through stories",
  Rhymes: "songs, actions and joyful first words",
  Drawing: "colours, strokes and creative expression",
};

function parseName(file: string): { grade: string; subject: string } | null {
  const base = file.toLowerCase().replace(/\.pdf$/, "").replace(/[^a-z0-9]/g, "");
  let grade: string | null = null;
  const g = base.match(/grade(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)grade|class(\d{1,2})/);
  if (g) grade = `Grade ${g[1] ?? g[2] ?? g[3]}`;
  else if (base.includes("nursery")) grade = "Nursery";
  else if (base.includes("lkg")) grade = "LKG";
  else if (base.includes("ukg")) grade = "UKG";
  if (!grade) return null;

  for (const key of Object.keys(SUBJECTS).sort((a, b) => b.length - a.length)) {
    if (base.includes(key)) return { grade, subject: SUBJECTS[key] };
  }
  return null;
}

function backCoverText(pdf: string): string {
  try {
    const raw = execFileSync("pdftotext", ["-f", "2", "-l", "2", pdf, "-"], {
      encoding: "utf8",
    });
    return raw
      .replace(/\s+/g, " ")
      .replace(/[^\x20-\x7Eऀ-ൿ]/g, "")
      .trim()
      .slice(0, 400);
  } catch {
    return "";
  }
}

async function main() {
  if (!existsSync(PDF_DIR)) {
    console.log(`No ${PDF_DIR} folder found; nothing to import.`);
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const pdfs = readdirSync(PDF_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  if (pdfs.length === 0) {
    console.log("No PDFs in assets/cover_pdfs/ yet.");
    return;
  }

  const primary = await db.category.findUniqueOrThrow({ where: { slug: "primary" } });
  const prePrimary = await db.category.findUniqueOrThrow({ where: { slug: "pre-primary" } });

  let added = 0;
  let skipped = 0;
  for (const file of pdfs) {
    const parsed = parseName(file);
    if (!parsed) {
      console.log(`?? cannot parse grade/subject from "${file}" - rename like Grade2_English.pdf`);
      continue;
    }
    const { grade, subject } = parsed;
    const gradeKey = grade.toLowerCase().replace(/\s/g, "");
    const subjectKey = subject.toLowerCase().replace(/\s/g, "-");
    const slug = `little-leaps-${gradeKey}-${subjectKey}`.replace("little-leaps-nursery", "baby-steps-nursery")
      .replace("little-leaps-lkg", "baby-steps-lkg")
      .replace("little-leaps-ukg", "baby-steps-ukg");

    const existing = await db.product.findFirst({
      where: { gradeLabel: grade, title: { contains: subject === "GK" ? "General Knowledge" : subject } },
    });
    if (existing) {
      console.log(`== ${grade} ${subject} already exists (${existing.slug}) - skipped (repeat)`);
      skipped++;
      continue;
    }

    // Front cover, high resolution (page 1 only)
    const pdfPath = path.join(PDF_DIR, file);
    const outBase = path.join(OUT_DIR, `${gradeKey}_${subjectKey}`);
    execFileSync("pdftoppm", ["-png", "-r", "220", "-f", "1", "-l", "1", pdfPath, outBase]);
    // pdftoppm names the file <base>-1.png (or -01.png)
    const produced = readdirSync(OUT_DIR).find(
      (f) => f.startsWith(`${gradeKey}_${subjectKey}-`) && f.endsWith(".png"),
    );
    if (!produced) throw new Error(`pdftoppm produced no page for ${file}`);
    const finalName = `${gradeKey}_${subjectKey}.png`;
    renameSync(path.join(OUT_DIR, produced), path.join(OUT_DIR, finalName));

    const back = backCoverText(pdfPath);
    const isPrePrimary = ["Nursery", "LKG", "UKG"].includes(grade);
    const series = isPrePrimary ? "Baby Steps" : "Little Leaps";
    const displaySubject = subject === "GK" ? "General Knowledge" : subject;
    const description =
      `The ${series} ${displaySubject} book for ${grade}, covering ${BLURB[subject] ?? "the full year's syllabus"}. ` +
      (back
        ? `From the book: "${back}" `
        : `Research-oriented design: every chapter opens with a real-life hook and closes with skill checks students can self-correct. `) +
      `Full-colour pages with QR-linked lessons on the SLPL LMS. Part of the complete ${series} set for ${grade}.`;

    const product = await db.product.upsert({
      where: { slug },
      update: { coverImage: `/seed/covers/subjects/${finalName}`, description },
      create: {
        slug,
        title: `${series} ${displaySubject}, ${grade}`,
        kind: "BOOK",
        categoryId: isPrePrimary ? prePrimary.id : primary.id,
        series,
        gradeLabel: grade,
        description,
        mrp: 29900, // dummy, owner edits in admin
        price: 24900,
        stock: 100,
        weightGrams: 350,
        coverImage: `/seed/covers/subjects/${finalName}`,
        isNewRelease: true,
        isVisible: true,
      },
    });

    const kit = await db.product.findFirst({ where: { kind: "BUNDLE", gradeLabel: grade } });
    if (kit) {
      await db.bundleItem.upsert({
        where: { bundleId_productId: { bundleId: kit.id, productId: product.id } },
        update: {},
        create: { bundleId: kit.id, productId: product.id, quantity: 1 },
      });
      if (!kit.isVisible) {
        await db.product.update({ where: { id: kit.id }, data: { isVisible: true } });
      }
    }
    console.log(`++ added ${grade} ${subject} (${slug})`);
    added++;
  }

  console.log(`\ndone: ${added} added, ${skipped} skipped as repeats`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
