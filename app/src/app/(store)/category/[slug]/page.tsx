import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ProductCard } from "@/components/store/product-card";
import { getActiveSale, getCategoryWithProducts } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryWithProducts(slug);
  return {
    title: category?.name ?? "Category",
    description: category?.description ?? undefined,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const [category, sale] = await Promise.all([getCategoryWithProducts(slug), getActiveSale()]);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <header className="mb-6 max-w-2xl">
        <h1 className="font-heading text-3xl font-bold">{category.name}</h1>
        {category.description && (
          <p className="mt-2 text-muted-foreground">{category.description}</p>
        )}
      </header>

      {category.products.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Titles for this category are on their way - check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {category.products.map((p) => (
            <ProductCard key={p.id} product={p} sale={sale} />
          ))}
        </div>
      )}
    </div>
  );
}
