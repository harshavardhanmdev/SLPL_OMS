import Link from "next/link";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Admin · Orders", robots: { index: false } };
export const dynamic = "force-dynamic";

const filters = [
  { key: "all", label: "All" },
  { key: "action", label: "Needs action" },
  { key: "AWAITING_PAYMENT", label: "Awaiting payment" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "problem", label: "Failed / cancelled" },
] as const;

type Props = { searchParams: Promise<{ f?: string }> };

export default async function AdminOrdersPage({ searchParams }: Props) {
  const { f = "action" } = await searchParams;

  const where =
    f === "all"
      ? {}
      : f === "action"
        ? { status: { in: ["PAID", "CONFIRMED", "PROCESSING", "COD_PENDING_OTP"] as OrderStatus[] } }
        : f === "problem"
          ? { status: { in: ["PAYMENT_FAILED", "EXPIRED", "CANCELLED", "REFUNDED"] as OrderStatus[] } }
          : { status: f as OrderStatus };

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: { select: { quantity: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Orders</h1>

      <div className="flex flex-wrap gap-2">
        {filters.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/orders?f=${tab.key}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              f === tab.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing here right now.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Items</th>
                <th className="p-3">Total</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-secondary/40">
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.orderNumber}`} className="font-medium underline-offset-2 hover:underline">
                      #{o.orderNumber}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className="block">{o.customerName}</span>
                    <span className="text-xs text-muted-foreground">{o.customerPhone}</span>
                  </td>
                  <td className="p-3">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td className="p-3 font-medium">{formatINR(o.total)}</td>
                  <td className="p-3 text-muted-foreground">{o.paymentMethod === "COD" ? "COD" : "Online"}</td>
                  <td className="p-3">
                    <Badge variant="secondary">{o.status.replaceAll("_", " ").toLowerCase()}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {o.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
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
