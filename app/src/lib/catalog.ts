import { db } from "@/lib/db";
import { type ActiveSale } from "@/lib/pricing";

export async function getActiveSale(): Promise<ActiveSale> {
  const now = new Date();
  const sale = await db.saleEvent.findFirst({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { startsAt: "desc" },
  });
  return sale
    ? {
        name: sale.name,
        bannerText: sale.bannerText,
        discountType: sale.discountType,
        value: sale.value,
        categoryIds: sale.categoryIds,
      }
    : null;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.setting.findUnique({ where: { key } });
  return (row?.value as T) ?? fallback;
}

export const productCardSelect = {
  id: true,
  slug: true,
  title: true,
  kind: true,
  series: true,
  gradeLabel: true,
  mrp: true,
  price: true,
  salePrice: true,
  saleStart: true,
  saleEnd: true,
  categoryId: true,
  stock: true,
  coverImage: true,
  isNewRelease: true,
} as const;

export async function getHomeData() {
  const [newReleases, featured, categories, bundleProducts, services, sale, notice] =
    await Promise.all([
      db.product.findMany({
        where: { isVisible: true, isNewRelease: true },
        select: productCardSelect,
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      db.product.findMany({
        where: { isVisible: true, isFeatured: true },
        select: productCardSelect,
        take: 4,
      }),
      db.category.findMany({
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { products: { where: { isVisible: true } } } } },
      }),
      db.product.findMany({
        where: { isVisible: true, kind: "BUNDLE" },
        select: productCardSelect,
        take: 6,
      }),
      db.servicePage.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
      getActiveSale(),
      getSetting<string>("store_notice", ""),
    ]);
  return { newReleases, featured, categories, bundleProducts, services, sale, notice };
}

// Alphabetical gradeLabel sorting puts Grade 10 before Grade 2 and LKG before
// Nursery, so rank grades and subjects explicitly and sort in JS.
const GRADE_ORDER = ["Nursery", "LKG", "UKG"];
const SUBJECT_ORDER = [
  "english", "telugu", "hindi", "math", "evs", "science", "social", "geography",
  "history", "general knowledge", "computer", "rhymes", "cursive", "handwriting",
  "writing", "drawing", "coloring",
];

export function gradeRank(gradeLabel: string | null): number {
  if (!gradeLabel) return 999;
  const named = GRADE_ORDER.indexOf(gradeLabel);
  if (named !== -1) return named;
  const num = gradeLabel.match(/(\d+)/);
  return num ? GRADE_ORDER.length + Number(num[1]) : 998;
}

function subjectRank(title: string): number {
  const t = title.toLowerCase();
  const i = SUBJECT_ORDER.findIndex((s) => t.includes(s));
  return i === -1 ? 999 : i;
}

export function sortByGradeThenSubject<T extends { title: string; gradeLabel: string | null }>(
  products: T[],
): T[] {
  return [...products].sort(
    (a, b) =>
      gradeRank(a.gradeLabel) - gradeRank(b.gradeLabel) ||
      subjectRank(a.title) - subjectRank(b.title) ||
      a.title.localeCompare(b.title),
  );
}

export async function getCategoryWithProducts(slug: string) {
  const category = await db.category.findUnique({
    where: { slug },
    include: {
      products: {
        where: { isVisible: true },
        select: productCardSelect,
      },
    },
  });
  if (!category) return null;
  return { ...category, products: sortByGradeThenSubject(category.products) };
}

export async function getProductBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, isVisible: true },
    include: {
      category: true,
      bundleItems: {
        // isVisible so the set page can list a volume that is not sold on its
        // own without linking to a page that would 404
        include: { product: { select: { ...productCardSelect, isVisible: true } } },
      },
    },
  });
}

/**
 * What to show under a book, in the order a parent actually thinks.
 *
 * First the kit it belongs to, because buying the set is cheaper than buying
 * the books one by one. Then the rest of that grade, because a parent shopping
 * for Grade 3 Maths needs Grade 3 Science next. Then the same series across
 * other grades, for the younger or older sibling.
 */
export async function getRelatedProducts(product: {
  id: string;
  categoryId: string;
  series: string | null;
  gradeLabel: string | null;
  kind: string;
}) {
  const visible = { isVisible: true, NOT: { id: product.id } } as const;

  const [kits, sameGrade, sameSeries] = await Promise.all([
    // Kits that contain this book
    product.kind === "BUNDLE"
      ? Promise.resolve([])
      : db.product.findMany({
          where: { ...visible, kind: "BUNDLE", bundleItems: { some: { productId: product.id } } },
          select: productCardSelect,
          take: 4,
        }),
    product.gradeLabel
      ? db.product.findMany({
          where: { ...visible, gradeLabel: product.gradeLabel, kind: { not: "BUNDLE" } },
          select: productCardSelect,
          take: 20,
        })
      : Promise.resolve([]),
    product.series
      ? db.product.findMany({
          where: { ...visible, series: product.series, kind: { not: "BUNDLE" } },
          select: productCardSelect,
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  // A title already shown in one rail should not appear again in the next
  const shown = new Set<string>([...kits, ...sameGrade].map((p) => p.id));
  const otherGrades = sortByGradeThenSubject(sameSeries.filter((p) => !shown.has(p.id))).slice(0, 12);

  // A standalone title like a novel has no grade and no series, so fall back to
  // the rest of its category. Small categories leave a thin rail, so top it up
  // with what the store is promoting rather than showing two lonely cards.
  let alsoLike: typeof sameGrade = [];
  if (sameGrade.length === 0 && otherGrades.length === 0) {
    alsoLike = await db.product.findMany({
      where: { ...visible, categoryId: product.categoryId },
      select: productCardSelect,
      orderBy: { isFeatured: "desc" },
      take: 12,
    });
    if (alsoLike.length < 6) {
      const seen = new Set(alsoLike.map((p) => p.id));
      const topUp = await db.product.findMany({
        where: {
          ...visible,
          kind: { not: "BUNDLE" },
          id: { notIn: [...seen] },
          OR: [{ isFeatured: true }, { isNewRelease: true }],
        },
        select: productCardSelect,
        orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
        take: 12 - alsoLike.length,
      });
      alsoLike = [...alsoLike, ...topUp];
    }
  }

  return {
    kits,
    sameGrade: sortByGradeThenSubject(sameGrade).slice(0, 12),
    otherGrades,
    alsoLike,
  };
}

// Search moved to src/lib/search.ts (synonyms + relevance scoring)
