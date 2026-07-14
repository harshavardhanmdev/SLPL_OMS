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

export async function getCategoryWithProducts(slug: string) {
  return db.category.findUnique({
    where: { slug },
    include: {
      products: {
        where: { isVisible: true },
        select: productCardSelect,
        orderBy: [{ gradeLabel: "asc" }, { title: "asc" }],
      },
    },
  });
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

export async function searchProducts(q: string) {
  if (!q.trim()) return [];
  return db.product.findMany({
    where: {
      isVisible: true,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { series: { contains: q, mode: "insensitive" } },
        { gradeLabel: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    select: productCardSelect,
    take: 40,
  });
}
