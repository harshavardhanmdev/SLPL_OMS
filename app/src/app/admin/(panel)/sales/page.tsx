import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { SaleEditor, type SaleRow } from "@/components/admin/sale-editor";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Admin · Festival sales", robots: { index: false } };
export const dynamic = "force-dynamic";

const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default async function AdminSalesPage() {
  const [sales, categories] = await Promise.all([
    db.saleEvent.findMany({ orderBy: { startsAt: "desc" } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const now = new Date();

  const rows: SaleRow[] = sales.map((s) => ({
    id: s.id,
    name: s.name,
    bannerText: s.bannerText,
    discountType: s.discountType,
    value: s.discountType === "FLAT" ? s.value / 100 : s.value,
    categoryIds: s.categoryIds,
    startsAt: toLocal(s.startsAt),
    endsAt: toLocal(s.endsAt),
    isActive: s.isActive,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Festival sales</h1>
          <p className="text-sm text-muted-foreground">
            Scheduled discounts with a home-page banner - they switch on and off automatically.
          </p>
        </div>
        <SaleEditor categories={categories} />
      </div>

      {sales.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No sales yet. Create one for Diwali, Dussehra, school-opening season…
        </p>
      ) : (
        <ul className="space-y-3">
          {sales.map((s, i) => {
            const live = s.isActive && s.startsAt <= now && s.endsAt >= now;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
                <div>
                  <p className="font-heading font-semibold">
                    {s.name}{" "}
                    {live ? (
                      <Badge className="ml-1 bg-green-600 text-white">live now</Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-1">
                        {s.isActive ? "scheduled" : "off"}
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">“{s.bannerText}”</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.discountType === "PERCENT" ? `${s.value}% off` : `${formatINR(s.value)} off`} ·{" "}
                    {s.startsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} →{" "}
                    {s.endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                    {s.categoryIds.length === 0 ? "whole store" : `${s.categoryIds.length} categories`}
                  </p>
                </div>
                <SaleEditor sale={rows[i]} categories={categories} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
