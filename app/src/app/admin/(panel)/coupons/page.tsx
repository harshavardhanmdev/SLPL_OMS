import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { CouponEditor, type CouponRow } from "@/components/admin/coupon-editor";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Admin · Coupons", robots: { index: false } };
export const dynamic = "force-dynamic";

const toLocal = (d: Date | null) =>
  d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : null;

export default async function AdminCouponsPage() {
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });

  const rows: CouponRow[] = coupons.map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    value: c.type === "FLAT" ? c.value / 100 : c.value,
    minOrder: c.minOrder / 100,
    maxDiscount: c.maxDiscount != null ? c.maxDiscount / 100 : null,
    startsAt: toLocal(c.startsAt),
    endsAt: toLocal(c.endsAt),
    usageLimit: c.usageLimit,
    isActive: c.isActive,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Coupons</h1>
        <CouponEditor />
      </div>

      {coupons.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No coupons yet - create one for your next festival sale.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Discount</th>
                <th className="p-3">Min order</th>
                <th className="p-3">Used</th>
                <th className="p-3">Window</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {coupons.map((c, i) => (
                <tr key={c.id} className="hover:bg-secondary/40">
                  <td className="p-3 font-mono font-semibold">{c.code}</td>
                  <td className="p-3">
                    {c.type === "PERCENT" ? `${c.value}%` : formatINR(c.value)}
                    {c.maxDiscount != null && (
                      <span className="block text-xs text-muted-foreground">cap {formatINR(c.maxDiscount)}</span>
                    )}
                  </td>
                  <td className="p-3">{c.minOrder > 0 ? formatINR(c.minOrder) : "-"}</td>
                  <td className="p-3">
                    {c.usedCount}
                    {c.usageLimit != null ? ` / ${c.usageLimit}` : ""}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {c.startsAt ? c.startsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"}
                    {" → "}
                    {c.endsAt ? c.endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"}
                  </td>
                  <td className="p-3">
                    <Badge variant={c.isActive ? "default" : "secondary"}>{c.isActive ? "active" : "off"}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    <CouponEditor coupon={rows[i]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
