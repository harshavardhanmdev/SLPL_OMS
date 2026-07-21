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
        include: { product: { select: productCardSelect } },
      },
    },
  });
}

// Search moved to src/lib/search.ts (synonyms + relevance scoring)
