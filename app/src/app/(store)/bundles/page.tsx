export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Layers } from "lucide-react";

import { ProductCard } from "@/components/store/product-card";
import { getActiveSale, getCategoryWithProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Class Bundles",
  description: "Complete SLPL book sets for each class at a bundled price — one order, one delivery, school-ready.",
};

export default async function BundlesPage() {
  const [category, sale] = await Promise.all([getCategoryWithProducts("bundles"), getActiveSale()]);
  const products = category?.products ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <div className="mb-3 inline-flex rounded-xl bg-accent p-3 text-saffron-deep">
          <Layers className="size-7" />
        </div>
        <h1 className="font-heading text-3xl font-bold">Complete class kits</h1>
        <p className="mt-2 text-muted-foreground">
          Every SLPL book a class needs for the year, packed as one kit at a
          bundled price — cheaper than buying titles one by one.
        </p>
      </header>

      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Bundles are being prepared — check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} sale={sale} />
          ))}
        </div>
      )}
    </div>
  );
}
