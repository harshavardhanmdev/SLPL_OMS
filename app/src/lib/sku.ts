/**
 * SLPL stock codes, straight from the master stock register.
 *
 * Grammar, as corrected by hand on the register sheets (the handwriting
 * overrides the typed proposal: levels became numeric, SB became SKB, and the
 * term moved into the trailing number rather than a separate T1 token):
 *
 *   Special publications   fixed code                        LOS01, UPSCFNDV02
 *   Baby Steps             BS + level + subject + serial      BS1TEL01, BS2HIN11
 *   Little Leaps           LL + grade + subject + term        LL3ENG01, LL1MAT02
 *   Skill Builders         SKB + index + subject + term       SKB4PHY01
 *
 * 145 titles in total. No server or database dependency, so the admin product
 * form can preview a code as it is typed.
 */

/** Printed books: HSN 4901, nil rated. Basis points keep 0% and 18% exact. */
export const BOOK_HSN = "4901";
export const BOOK_GST_BP = 0;
/** Education services. */
export const SERVICE_SAC = "9992";
export const SERVICE_GST_BP = 1800;

export type SkuInput = {
  slug: string;
  title: string;
  series?: string | null;
  gradeLabel?: string | null;
  /** Little Leaps and Skill Builders run two terms. Only term 1 is in print. */
  term?: 1 | 2;
};

// ── Special publications ─────────────────────────────────────────────────────
// Section 1 of the register, pages 1 to 15. Fixed codes, no grammar.

const SPECIAL_BY_SLUG: Record<string, string> = {
  "life-of-student": "LOS01",
  pusthakavilapam: "PUS01",
  "seasons-of-my-soul": "SMS01",
  "upsc-foundation-volume-1": "UPSCFNDV01",
  "upsc-foundation-volume-2": "UPSCFNDV02",
  "upsc-foundation-volume-3": "UPSCFNDV03",
  "compendium-of-competitive-english": "CCE01",
  "mental-ability-test": "MAT01",
  // Added 12 Sep 2026, a separate title from CCE01, so the register is 146
  "advanced-english": "AEN01",
};

// ── Baby Steps ───────────────────────────────────────────────────────────────
// The trailing serial is the title's POSITION in that level's register list,
// not a global subject number. So Rhymes is 09 at UKG but 10 at Nursery and
// LKG, because UKG has no Lines and Patterns book.

const BABY_STEPS: Record<string, { level: number; order: string[] }> = {
  Nursery: {
    level: 1,
    order: ["TEL", "ECB", "EWB", "MCB", "MWB", "EVCB", "EVWB", "DRW", "LNP", "RYS"],
  },
  LKG: {
    level: 2,
    order: ["TEL", "ECB", "EWB", "MCB", "MWB", "EVCB", "EVWB", "DRW", "LNP", "RYS", "HIN"],
  },
  UKG: {
    level: 3,
    order: ["TEL", "ECB", "EWB", "MCB", "MWB", "EVCB", "EVWB", "DRW", "RYS", "HIN"],
  },
};

/**
 * Baby Steps titles are marketing names ("My First Numbers", "I Can Count and
 * Think"), so the subject is read from the words rather than a code in the
 * title. Order matters: EVS is checked before English because an EVS work book
 * is not an English one.
 */
function babyStepsSubject(title: string): string | null {
  const t = title.toLowerCase();
  const workbook = /work\s*book|practice|activity/.test(t);

  if (/telugu|aksharamala/.test(t)) return "TEL";
  if (/hindi|akshar gyan|shabd gyan/.test(t)) return "HIN";
  if (/lines and patterns/.test(t)) return "LNP";
  if (/drawing|colou?ring|artist/.test(t)) return "DRW";
  if (/rhyme|song|stories/.test(t)) return "RYS";
  if (/\bevs\b|environment|my world|our world/.test(t)) return workbook ? "EVWB" : "EVCB";
  if (/english|letters|read and write/.test(t)) return workbook ? "EWB" : "ECB";
  if (/math|number|count/.test(t)) return workbook ? "MWB" : "MCB";
  return null;
}

// ── Little Leaps and Skill Builders ──────────────────────────────────────────

const LITTLE_LEAPS_SUBJECTS: [RegExp, string][] = [
  [/telugu/i, "TEL"],
  [/hindi/i, "HIN"],
  [/english/i, "ENG"],
  [/math/i, "MAT"],
  [/science/i, "SCI"],
  [/social/i, "SOC"],
  [/computer/i, "COM"],
  [/general knowledge|\bgk\b/i, "GKB"],
];

/** Grades 6 and 7 take general science; 8 to 10 split it into physics and biology. */
const SKILL_BUILDERS_SUBJECTS: [RegExp, string][] = [
  [/english/i, "ENG"],
  [/math/i, "MAT"],
  [/physics/i, "PHY"],
  [/biolog/i, "BIO"],
  [/social/i, "SOC"],
  [/science/i, "GSC"],
];

function matchSubject(table: [RegExp, string][], title: string): string | null {
  for (const [pattern, token] of table) if (pattern.test(title)) return token;
  return null;
}

function gradeNumber(gradeLabel: string | null | undefined): number | null {
  const m = /(\d+)/.exec(gradeLabel ?? "");
  return m ? Number(m[1]) : null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// ── The generator ────────────────────────────────────────────────────────────

/**
 * The register code for a title, or null when the scheme does not cover it.
 * Null is the honest answer: a made-up code in a stock register is worse than
 * no code, because it cannot be reconciled against the physical pages.
 */
export function skuFor(input: SkuInput): string | null {
  const special = SPECIAL_BY_SLUG[input.slug];
  if (special) return special;

  const series = input.series ?? "";
  const term = input.term ?? 1;

  // Baby Steps 1/2/3 in the catalog, Nursery/LKG/UKG on the register
  if (/^baby steps/i.test(series)) {
    const level = BABY_STEPS[input.gradeLabel ?? ""];
    if (!level) return null;
    const subject = babyStepsSubject(input.title);
    if (!subject) return null;
    const position = level.order.indexOf(subject);
    if (position < 0) return null; // e.g. a Hindi book at Nursery, which has none
    return `BS${level.level}${subject}${pad2(position + 1)}`;
  }

  if (/^little leaps/i.test(series)) {
    const grade = gradeNumber(input.gradeLabel);
    if (grade == null || grade < 1 || grade > 5) return null;
    const subject = matchSubject(LITTLE_LEAPS_SUBJECTS, input.title);
    if (!subject) return null;
    return `LL${grade}${subject}${pad2(term)}`;
  }

  if (/^skill builders/i.test(series)) {
    const grade = gradeNumber(input.gradeLabel);
    if (grade == null || grade < 6 || grade > 10) return null;
    const subject = matchSubject(SKILL_BUILDERS_SUBJECTS, input.title);
    if (!subject) return null;
    // Grades 6 and 7 have no separate physics or biology on the register
    if (grade <= 7 && (subject === "PHY" || subject === "BIO")) return null;
    if (grade >= 8 && subject === "GSC") return null;
    return `SKB${grade - 5}${subject}${pad2(term)}`;
  }

  return null;
}

/** How many titles each section of the register holds, for reconciliation. */
export const REGISTER_TOTALS = {
  special: 9, // 8 printed on the register, plus AEN01
  babySteps: 31,
  littleLeaps: 60,
  skillBuilders: 46,
  total: 146,
} as const;
