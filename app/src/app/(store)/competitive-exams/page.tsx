export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Landmark } from "lucide-react";

import { ProductCard } from "@/components/store/product-card";
import { db } from "@/lib/db";
import { getActiveSale, productCardSelect, sortByGradeThenSubject } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Competitive Exams",
  description:
    "Saaradaa's Civil Services Aspirant Program - Skill Builders Social Studies and English for Grades 6 to 10, building UPSC Civils and competitive exam foundations from school age.",
};

export default async function CompetitiveExamsPage() {
  const [products, sale] = await Promise.all([
    db.product.findMany({
      where: {
        isVisible: true,
        category: { is: { slug: "high-school" } },
        OR: [
          { title: { contains: "Social", mode: "insensitive" } },
          { title: { contains: "English", mode: "insensitive" } },
        ],
      },
      select: productCardSelect,
    }),
    getActiveSale(),
  ]);
  const sorted = sortByGradeThenSubject(products);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <div className="mb-3 inline-flex rounded-xl bg-accent p-3 text-saffron-deep">
          <Landmark className="size-7" />
        </div>
        <h1 className="font-heading text-3xl font-bold">Competitive exams</h1>
        <p className="mt-2 text-muted-foreground">
          Saaradaa&apos;s Civil Services Aspirant Program: our Skill Builders
          Social Studies and English books for Grades 6 to 10 double as a
          five-step foundation for UPSC Civils and other competitive exams,
          building the reading depth and general-studies base years before
          coaching begins.
        </p>
      </header>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Titles for this program are on their way - check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sorted.map((p) => (
            <ProductCard key={p.id} product={p} sale={sale} />
          ))}
        </div>
      )}
    </div>
  );
}
