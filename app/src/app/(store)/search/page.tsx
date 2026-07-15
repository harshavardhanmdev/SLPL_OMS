import type { Metadata } from "next";
import { SearchX } from "lucide-react";

import { ProductCard } from "@/components/store/product-card";
import { getActiveSale, searchProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Search" };

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const [results, sale] = await Promise.all([searchProducts(q), getActiveSale()]);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <form action="/search" className="mb-6 max-w-xl" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by title, series or grade…"
          autoFocus
          className="h-12 w-full rounded-full border border-input bg-muted/60 px-5 text-base outline-none transition-colors focus:border-ring focus:bg-background"
        />
      </form>

      {q.trim() === "" ? (
        <p className="text-muted-foreground">Type to search across all SLPL titles.</p>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <SearchX className="size-8 text-muted-foreground" />
          <p className="font-medium">No titles matched “{q}”</p>
          <p className="text-sm text-muted-foreground">Try a series name like “Skill Builders” or a grade like “Grade 6”.</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? "result" : "results"} for “{q}”
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} sale={sale} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
