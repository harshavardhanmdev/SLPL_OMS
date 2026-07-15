import "server-only";

import { db } from "@/lib/db";
import { productCardSelect } from "@/lib/catalog";

/**
 * Store search with synonym expansion and relevance scoring, so
 * "UKG books" finds Baby Steps UKG and related Pre-Primary titles,
 * "class 3 maths" finds Grade 3 Math, "civils" finds UPSC material.
 */

const STOPWORDS = new Set(["book", "books", "the", "a", "an", "for", "of", "and", "buy"]);

const SYNONYMS: Record<string, string[]> = {
  ukg: ["baby steps", "pre-primary", "ukg"],
  lkg: ["baby steps", "pre-primary", "lkg"],
  nursery: ["baby steps", "pre-primary", "nursery"],
  preprimary: ["pre-primary", "baby steps"],
  kindergarten: ["baby steps", "pre-primary"],
  primary: ["primary", "little leaps"],
  upsc: ["upsc", "skill builders", "civils"],
  civils: ["upsc", "skill builders"],
  ias: ["upsc", "civils"],
  gk: ["general knowledge"],
  maths: ["math"],
  math: ["math", "maths"],
  novel: ["novel", "life of student"],
  poem: ["poems"],
  poems: ["poems"],
  bundle: ["kit", "bundle"],
  kit: ["kit", "bundle"],
};

function expandTokens(query: string): string[] {
  const raw = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const tokens = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    let t = raw[i];
    if (STOPWORDS.has(t)) continue;
    if (t === "class" || t === "std" || t === "standard") t = "grade";
    // "3rd" / "3" following or preceding grade words → "grade 3"
    const num = t.match(/^(\d{1,2})(st|nd|rd|th)?$/);
    if (num) {
      tokens.add(`grade ${num[1]}`);
      continue;
    }
    tokens.add(t);
    for (const extra of SYNONYMS[t] ?? []) tokens.add(extra);
  }
  // Join "grade" + following number ("grade 4" typed as two tokens)
  const joined = query.toLowerCase().match(/(?:grade|class|std)\s*(\d{1,2})/);
  if (joined) tokens.add(`grade ${joined[1]}`);
  tokens.delete("grade");
  return [...tokens].slice(0, 12);
}

export async function searchProducts(q: string) {
  const tokens = expandTokens(q);
  if (tokens.length === 0) return [];

  const rows = await db.product.findMany({
    where: {
      isVisible: true,
      OR: tokens.flatMap((t) => [
        { title: { contains: t, mode: "insensitive" as const } },
        { series: { contains: t, mode: "insensitive" as const } },
        { gradeLabel: { contains: t, mode: "insensitive" as const } },
        { description: { contains: t, mode: "insensitive" as const } },
        { category: { is: { name: { contains: t, mode: "insensitive" as const } } } },
      ]),
    },
    select: {
      ...productCardSelect,
      description: true,
      category: { select: { name: true } },
    },
    take: 80,
  });

  const scored = rows
    .map((p) => {
      let score = 0;
      const title = p.title.toLowerCase();
      const series = (p.series ?? "").toLowerCase();
      const grade = (p.gradeLabel ?? "").toLowerCase();
      const cat = p.category.name.toLowerCase();
      const desc = p.description.toLowerCase();
      for (const t of tokens) {
        if (title.includes(t)) score += 3;
        if (series.includes(t) || grade.includes(t)) score += 2.5;
        if (cat.includes(t)) score += 2;
        if (desc.includes(t)) score += 1;
      }
      if (p.isNewRelease) score += 0.5;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  return scored.map(({ p }) => {
    // Strip the scoring-only fields back to the card shape

    const { description: _d, category: _c, ...card } = p;
    return card;
  });
}
