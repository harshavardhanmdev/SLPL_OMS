import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, IndianRupee, Package, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Admin · Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

const PAID_STATUSES = ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export default async function AdminDashboard() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const [todayOrders, todayRevenue, pendingShip, lowStock, recent] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: midnight }, status: { in: [...PAID_STATUSES] } } }),
    db.order.aggregate({
      where: { createdAt: { gte: midnight }, status: { in: [...PAID_STATUSES] } },
      _sum: { total: true },
    }),
    db.order.count({ where: { status: { in: ["PAID", "CONFIRMED", "PROCESSING"] } } }),
    db.product.findMany({
      where: { isVisible: true, stock: { lte: 5 } },
      orderBy: { stock: "asc" },
      take: 6,
      select: { id: true, title: true, stock: true },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { orderNumber: true, customerName: true, total: true, status: true, createdAt: true },
    }),
  ]);

  const stats = [
    { label: "Orders today", value: String(todayOrders), icon: Package },
    { label: "Revenue today", value: formatINR(todayRevenue._sum.total ?? 0), icon: IndianRupee },
    { label: "Waiting to ship", value: String(pendingShip), icon: Truck },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border bg-card p-5">
            <Icon className="mb-2 size-5 text-saffron-deep" />
            <p className="font-heading text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-2xl border border-saffron/50 bg-accent/50 p-5">
          <p className="mb-2 flex items-center gap-2 font-heading font-semibold">
            <AlertTriangle className="size-4 text-saffron-deep" /> Low stock
          </p>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {lowStock.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}`} className="underline-offset-2 hover:underline">
                  {p.title}
                </Link>{" "}
                — <b>{p.stock} left</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-heading font-semibold">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm font-medium text-saffron-deep hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No orders yet — they will appear here.</p>
        ) : (
          <ul className="divide-y">
            {recent.map((o) => (
              <li key={o.orderNumber}>
                <Link
                  href={`/admin/orders/${o.orderNumber}`}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 transition-colors hover:bg-secondary/50"
                >
                  <span className="min-w-0">
                    <span className="font-medium">#{o.orderNumber}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{o.customerName}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge variant="secondary">{o.status.replaceAll("_", " ").toLowerCase()}</Badge>
                    <span className="font-medium">{formatINR(o.total)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
