export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Layers } from "lucide-react";

import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: { where: { isVisible: true } } } } },
  });

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-heading text-3xl font-bold">Browse categories</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={cat.slug === "bundles" ? "/bundles" : `/category/${cat.slug}`}
            className="group flex items-start gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-saffron/60 hover:shadow-lg"
          >
            <div className="rounded-xl bg-accent p-3 text-saffron-deep">
              {cat.slug === "bundles" ? <Layers className="size-6" /> : <BookOpen className="size-6" />}
            </div>
            <div>
              <h2 className="font-heading font-semibold">{cat.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{cat.description}</p>
              <p className="mt-1.5 text-xs font-medium text-saffron-deep">
                {cat._count.products} {cat._count.products === 1 ? "title" : "titles"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
