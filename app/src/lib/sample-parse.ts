/**
 * Turns what a salesperson types or says into the samples to record:
 * "grade 5 all books", "grades 1 to 5", "upsc 6 to 10", "2 copies of grade 3
 * english and telugu", "nursery to ukg", "genz times". Plain rules over the
 * book list, run on the phone as they type; nothing is sent anywhere to guess.
 *
 * A whole grade becomes one row (its full set, with the books listed under
 * it), so handing it to a school is one tap. Naming subjects gives those
 * titles; "each book" or "separately" lists every title as its own row.
 */

export type Series = "BS" | "LL" | "UPSC" | "SKB" | "UPSCF" | "GENZ" | "OTHER";

export type SampleBook = {
  key: string;
  title: string;
  series: Series;
  /** "Nursery", "LKG", "UKG" or "1" to "10" */
  grade: string | null;
  term2: boolean;
  isSet: boolean;
  contents: string | null;
  productId: string | null;
};

export type SamplePick = {
  key: string;
  title: string;
  contents: string | null;
  productId: string | null;
  quantity: number;
};

export type ParseResult = { picks: SamplePick[]; unknown: string[]; notes: string[] };

const KG = ["Nursery", "LKG", "UKG"];
const SERIES_NAME: Record<Series, string> = {
  BS: "Baby Steps",
  LL: "Little Leaps",
  UPSC: "UPSC full set",
  SKB: "Skill Builders",
  UPSCF: "UPSC Foundation",
  GENZ: "The GenZ Times",
  OTHER: "",
};

const WORD_NUMBERS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  first: "1st",
  second: "2nd",
  third: "3rd",
  fourth: "4th",
  fifth: "5th",
  sixth: "6th",
  seventh: "7th",
  eighth: "8th",
  ninth: "9th",
  tenth: "10th",
  single: "1",
  couple: "2",
};

/** Subject words as people say them, each with what to look for in a title. */
const SUBJECTS: [RegExp, string][] = [
  [/\benglish\b|\beng\b/, "english"],
  [/\bmaths?\b|\bmathematics\b/, "math"],
  [/\bscience\b|\bsci\b/, "science"],
  [/\bevs\b|\benvironment/, "evs"],
  [/\bsocial\b|\bsst\b|\bsocial studies\b/, "social"],
  [/\btelugu\b/, "telugu"],
  [/\bhindi\b/, "hindi"],
  [/\bcomputers?\b/, "computer"],
  [/\bgk\b|\bgeneral knowledge\b/, "gk"],
  [/\bdrawing\b|\bcolou?ring\b/, "drawing"],
  [/\brhymes?\b/, "rhymes"],
  [/\bline patterns?\b|\bpatterns?\b/, "pattern"],
  [/\bbiology\b|\bbio\b/, "biology"],
  [/\bphysics\b/, "physics"],
  [/\bchemistry\b/, "chemistry"],
];

const norm = (s: string) =>
  s
    .toLowerCase()
    // "1-5" is a range, before the hyphen goes with the rest of the punctuation
    .replace(/(\d)\s*[-\u2013]\s*(\d)/g, "$1 to $2")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function words(text: string) {
  return text
    .split(" ")
    .map((w) => WORD_NUMBERS[w] ?? w)
    .join(" ");
}

/** Every grade a phrase names: "grades 1 to 5", "class 3 and 4", "5th", "nursery to ukg", "kg". */
function gradesIn(t: string, series: Series | null): string[] {
  const out: string[] = [];
  const add = (g: string) => !out.includes(g) && out.push(g);

  // Pre-primary by name, alone or as a range
  const kgRange = t.match(/\b(nursery|lkg|ukg)\s+(?:to|till|through)\s+(nursery|lkg|ukg)\b/);
  if (kgRange) {
    const [a, b] = [kgRange[1], kgRange[2]].map((x) => KG.findIndex((k) => k.toLowerCase() === x));
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) add(KG[i]);
  }
  for (const k of KG) if (new RegExp(`\\b${k.toLowerCase()}\\b`).test(t)) add(k);
  if (/\bnur\b|\bpre nursery\b/.test(t)) add("Nursery");
  if (/\b(all )?kg\b|\bpre ?primary\b/.test(t) && !/\b[lu]kg\b/.test(t)) KG.forEach(add);

  // Numbered grades: after grade/class/std, as ordinals, or bare after a series name
  const numbers = (chunk: string) => {
    for (const m of chunk.matchAll(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:(?:to|till|through|-)\s*(\d{1,2}))?/g)) {
      const a = Number(m[1]);
      const b = m[2] ? Number(m[2]) : a;
      for (let g = Math.min(a, b); g <= Math.max(a, b); g++) if (g >= 1 && g <= 10) add(String(g));
    }
  };
  for (const m of t.matchAll(
    /\b(?:grades?|class(?:es)?|std|standards?)\s+((?:\d{1,2}(?:st|nd|rd|th)?(?:\s*(?:to|till|through|and|or|-)\s*|\s+)?)+)/g,
  )) {
    numbers(m[1]);
  }
  for (const m of t.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)\s*(?:grade|class|std|standard)?\b/g)) numbers(m[1]);
  if (series && ["LL", "UPSC", "SKB"].includes(series) && out.length === 0) {
    const tail = t.replace(/\b\d+\s*(?:copies|copy|sets?|nos?|pcs|pieces|each)\b/g, " ");
    numbers(tail);
  }
  return out;
}

function seriesIn(t: string): Series | null {
  if (/\bfoundation\b|\bupsc vol|\bvolume\b/.test(t)) return "UPSCF";
  if (/\bupsc\b/.test(t)) return "UPSC";
  if (/\bskill builders?\b|\bskb\b|\bskill\b/.test(t)) return "SKB";
  if (/\blittle leaps\b|\bll\b/.test(t)) return "LL";
  if (/\bbaby steps\b|\bbabysteps\b/.test(t)) return "BS";
  if (/\bgen ?z\b|\bmagazine\b|\btimes\b/.test(t)) return "GENZ";
  return null;
}

/** The series a grade belongs to when nobody named one. */
function seriesForGrade(g: string): Series {
  if (KG.includes(g)) return "BS";
  return Number(g) <= 5 ? "LL" : "UPSC";
}

/** How many of each: "x2", "2 copies", "two sets", "3 each". */
function quantityIn(t: string): { quantity: number; rest: string } {
  const m =
    t.match(/\b(?:x|qty|quantity)\s*(\d+)\b/) ??
    t.match(/\b(\d+)\s*(?:copies|copy|sets?|nos?|pcs|pieces|each|kits?)\b/);
  if (!m) return { quantity: 1, rest: t };
  return { quantity: Math.max(1, Math.min(500, Number(m[1]))), rest: t.replace(m[0], " ") };
}

const label = (g: string) => (KG.includes(g) ? g : `Grade ${g}`);

/** Split on commas, "and" between separate requests, "plus", new lines. */
function segments(text: string): string[] {
  return text
    .split(/[,;\n+]|\balso\b|\bplus\b|\band then\b/)
    .flatMap((part) =>
      part.split(
        /\band\b(?!\s*\d)(?=\s*(?:\d+\s*(?:copies|copy|sets?)\b|upsc|skill|genz|gen z|little|baby|nursery|lkg|ukg|grade|class|std|the genz))/,
      ),
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The one book a loose phrase names, or null when it names none or several. */
function fuzzy(t: string, books: SampleBook[]): SampleBook | null {
  const stop = new Set([
    "the",
    "of",
    "a",
    "an",
    "book",
    "books",
    "for",
    "and",
    "copy",
    "copies",
    "set",
    "sets",
  ]);
  const tokens = t.split(" ").filter((w) => w.length > 1 && !stop.has(w));
  if (tokens.length === 0) return null;
  let best: SampleBook | null = null;
  let bestScore = 0;
  for (const b of books) {
    const title = norm(b.title);
    const score = tokens.filter((w) => title.includes(w)).length / tokens.length;
    if (score > bestScore || (score === bestScore && best && b.title.length < best.title.length)) {
      best = b;
      bestScore = score;
    }
  }
  if (bestScore < 0.6) return null;
  // "telugu" alone fits a Telugu book in every grade: better to ask than guess
  const ties = books.filter((b) => {
    const title = norm(b.title);
    return tokens.filter((w) => title.includes(w)).length / tokens.length === bestScore;
  });
  return ties.length === 1 ? best : null;
}

export function parseSamples(text: string, books: SampleBook[]): ParseResult {
  const picks: SamplePick[] = [];
  const unknown: string[] = [];
  const notes: string[] = [];
  const add = (b: SampleBook, quantity: number, override?: { title: string; contents: string }) => {
    const key = override ? `${b.key}:all` : b.key;
    const found = picks.find((p) => p.key === key);
    if (found) found.quantity += quantity;
    else
      picks.push({
        key,
        title: override?.title ?? b.title,
        contents: override?.contents ?? b.contents,
        productId: override ? null : b.productId,
        quantity,
      });
  };

  for (const raw of segments(text)) {
    const t0 = words(norm(raw));
    if (!t0) continue;
    const { quantity, rest: t } = quantityIn(t0);
    const named = seriesIn(t);
    const grades = gradesIn(t, named);
    const subjects = SUBJECTS.filter(([re]) => re.test(t)).map(([, s]) => s);
    const term2 = /\bterm 2\b|\bterm two\b|\bt2\b|\bsecond term\b/.test(t);
    const each =
      /\beach book\b|\bseparately\b|\bevery (?:book|title)\b|\bindividual\b|\ball titles\b|\bone by one\b/.test(
        t,
      );

    // Series without grades: the magazine, the foundation volumes, or every grade of a series
    if (grades.length === 0) {
      if (named === "GENZ") {
        const issues = books
          .filter((b) => b.series === "GENZ")
          .sort((a, b) => a.title.localeCompare(b.title));
        const asked = t.match(/\bissue\s*0?(\d+)/);
        const issue = asked
          ? issues.find((b) => new RegExp(`issue 0?${asked[1]}\\b`, "i").test(b.title))
          : issues.at(-1);
        if (issue) add(issue, quantity);
        else unknown.push(raw);
        continue;
      }
      if (named === "UPSCF") {
        const set = books.find((b) => b.series === "UPSCF" && b.isSet);
        const vol = t.match(/\b(?:vol|volume)\s*(\d)\b/);
        const one = vol
          ? books.find(
              (b) => b.series === "UPSCF" && !b.isSet && new RegExp(`volume ${vol[1]}\\b`, "i").test(b.title),
            )
          : null;
        if (one ?? set) add((one ?? set)!, quantity);
        else unknown.push(raw);
        continue;
      }
      if (named && named !== "OTHER") {
        const all = [...new Set(books.filter((b) => b.series === named && b.grade).map((b) => b.grade!))];
        if (all.length && /\ball\b|\bevery\b|\bfull\b/.test(t)) grades.push(...all);
      }
    }

    if (grades.length === 0) {
      const hit = fuzzy(t, books);
      if (hit) add(hit, quantity);
      else {
        unknown.push(raw);
        if (subjects.length) notes.push(`Say which grade for "${raw}".`);
      }
      continue;
    }

    for (const g of grades) {
      // Grades 6 to 10 come as UPSC sets unless Skill Builders is said
      const series = named && named !== "GENZ" && named !== "UPSCF" ? named : seriesForGrade(g);
      const inGrade = books.filter((b) => b.series === series && b.grade === g);
      if (inGrade.length === 0) {
        notes.push(`No ${SERIES_NAME[series]} books for ${label(g)}.`);
        continue;
      }
      const titles = inGrade.filter((b) => !b.isSet);
      if (subjects.length > 0 || term2) {
        const wanted = titles.filter((b) => {
          const tt = norm(b.title);
          return (subjects.length === 0 || subjects.some((s) => tt.includes(s))) && b.term2 === term2;
        });
        if (wanted.length === 0)
          notes.push(`Nothing matching that subject in ${SERIES_NAME[series]} ${label(g)}.`);
        wanted.forEach((b) => add(b, quantity));
        continue;
      }
      if (each) {
        titles.forEach((b) => add(b, quantity));
        continue;
      }
      const set = inGrade.find((b) => b.isSet);
      if (set) add(set, quantity);
      else {
        // No set on the books for it (Skill Builders): one row holding every title
        const list = titles.filter((b) => !b.term2);
        add(list[0], quantity, {
          title: `${SERIES_NAME[series]} ${label(g)}, all ${list.length} books`,
          contents: list.map((b) => b.title).join(" · "),
        });
      }
      if (series === "UPSC" && !named && Number(g) >= 6) {
        const note = "Grades 6 to 10 taken as UPSC full sets. Say Skill Builders for those.";
        if (!notes.includes(note)) notes.push(note);
      }
    }
  }
  return { picks, unknown, notes };
}
