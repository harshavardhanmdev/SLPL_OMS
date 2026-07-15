import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { BookOpen, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VisibilityToggle } from "@/components/admin/visibility-toggle";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Admin · Products", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await db.product.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { gradeLabel: "asc" }, { title: "asc" }],
    include: { category: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Products ({products.length})</h1>
        <Button className="gap-2" asChild>
          <Link href="/admin/products/new">
            <Plus className="size-4" /> New product
          </Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Category</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Flags</th>
              <th className="p-3">Visible</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-secondary/40">
                <td className="p-3">
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                    <span className="relative block h-14 w-10 shrink-0 overflow-hidden rounded border bg-muted">
                      {p.coverImage ? (
                        <Image src={p.coverImage} alt="" fill sizes="40px" className="object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center">
                          <BookOpen className="size-4 text-muted-foreground/40" />
                        </span>
                      )}
                    </span>
                    <span>
                      <span className="block font-medium underline-offset-2 hover:underline">{p.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {[p.series, p.gradeLabel].filter(Boolean).join(" · ") || p.kind.toLowerCase()}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{p.category.name}</td>
                <td className="p-3">
                  <span className="font-medium">{formatINR(p.price)}</span>
                  <span className="block text-xs text-muted-foreground line-through">{formatINR(p.mrp)}</span>
                </td>
                <td className="p-3">
                  <span className={p.stock <= 5 ? "font-semibold text-destructive" : ""}>{p.stock}</span>
                </td>
                <td className="p-3">
                  <span className="flex flex-wrap gap-1">
                    {p.kind === "BUNDLE" && <Badge variant="secondary">bundle</Badge>}
                    {p.isNewRelease && <Badge className="bg-saffron text-navy">new</Badge>}
                    {p.isFeatured && <Badge variant="secondary">featured</Badge>}
                    {p.samplePdf && <Badge variant="outline">pdf</Badge>}
                  </span>
                </td>
                <td className="p-3">
                  <VisibilityToggle id={p.id} visible={p.isVisible} />
                </td>
                <td className="p-3">
                  <ProductRowActions id={p.id} title={p.title} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
