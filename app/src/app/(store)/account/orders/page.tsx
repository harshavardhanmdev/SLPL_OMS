import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Package, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/store/product-card";
import { getActiveSale, productCardSelect } from "@/lib/catalog";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Returns & Orders" };
export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  COD_PENDING_OTP: "Confirm COD",
  PAID: "Paid",
  CONFIRMED: "Confirmed",
  PAYMENT_FAILED: "Payment failed",
  EXPIRED: "Expired",
  PROCESSING: "Packing",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/orders");

  const [orders, sale] = await Promise.all([
    db.order.findMany({
      where: { userId: session.uid },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { items: { take: 3 } },
    }),
    getActiveSale(),
  ]);

  // Buy Again: distinct products from successful past orders, still available
  const boughtIds = await db.orderItem.findMany({
    where: {
      productId: { not: null },
      order: {
        userId: session.uid,
        status: { in: ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] },
      },
    },
    select: { productId: true },
    distinct: ["productId"],
    take: 12,
  });
  const buyAgain = await db.product.findMany({
    where: { id: { in: boughtIds.map((b) => b.productId!) }, isVisible: true },
    select: productCardSelect,
    take: 8,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/account" aria-label="Back to account">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-bold">Returns & Orders</h1>
      </div>

      {buyAgain.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold">
            <RotateCcw className="size-5 text-saffron-deep" /> Buy again
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {buyAgain.map((p) => (
              <ProductCard key={p.id} product={p} sale={sale} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold">
          <Package className="size-5 text-saffron-deep" /> Your orders
        </h2>
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">No orders yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Your orders and tracking will appear here.</p>
            <Button className="mt-4" asChild>
              <Link href="/categories">Browse books</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-saffron/60"
                >
                  <div>
                    <p className="font-medium">#{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.items.map((i) => i.title).join(", ")}
                      {order.items.length >= 3 ? "…" : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {order.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{statusLabel[order.status] ?? order.status}</Badge>
                    <p className="mt-1.5 font-heading font-semibold">{formatINR(order.total)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Damaged or wrong book? Open the order and reach us within 48 hours of delivery; we replace it.
        </p>
      </section>
    </div>
  );
}
