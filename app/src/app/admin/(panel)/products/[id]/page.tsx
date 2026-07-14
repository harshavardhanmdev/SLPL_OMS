import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ProductForm, type ProductFormValue } from "@/components/admin/product-form";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Admin · Edit product", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const toLocalInput = (d: Date | null) =>
  d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : null;

export default async function AdminProductEditPage({ params }: Props) {
  const { id } = await params;
  const [categories, memberOptions] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({
      where: { kind: { not: "BUNDLE" } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  let initial: ProductFormValue;
  if (id === "new") {
    initial = {
      title: "",
      slug: "",
      kind: "BOOK",
      categoryId: categories[0]?.id ?? "",
      series: "",
      gradeLabel: "",
      description: "",
      mrp: 39900,
      price: 34900,
      salePrice: null,
      saleStart: null,
      saleEnd: null,
      stock: 100,
      weightGrams: 350,
      coverImage: null,
      gallery: [],
      samplePdf: null,
      isNewRelease: false,
      isFeatured: false,
      isVisible: false,
      bundleItems: [],
    };
  } else {
    const product = await db.product.findUnique({
      where: { id },
      include: { bundleItems: true },
    });
    if (!product) notFound();
    initial = {
      id: product.id,
      title: product.title,
      slug: product.slug,
      kind: product.kind,
      categoryId: product.categoryId,
      series: product.series ?? "",
      gradeLabel: product.gradeLabel ?? "",
      description: product.description,
      mrp: product.mrp,
      price: product.price,
      salePrice: product.salePrice,
      saleStart: toLocalInput(product.saleStart),
      saleEnd: toLocalInput(product.saleEnd),
      stock: product.stock,
      weightGrams: product.weightGrams,
      coverImage: product.coverImage,
      gallery: product.gallery,
      samplePdf: product.samplePdf,
      isNewRelease: product.isNewRelease,
      isFeatured: product.isFeatured,
      isVisible: product.isVisible,
      bundleItems: product.bundleItems.map((b) => ({ productId: b.productId, quantity: b.quantity })),
    };
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">
        {id === "new" ? "New product" : `Edit: ${initial.title}`}
      </h1>
      <ProductForm initial={initial} categories={categories} memberOptions={memberOptions} />
    </div>
  );
}
