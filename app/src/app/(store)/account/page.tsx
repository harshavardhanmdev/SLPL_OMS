import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, MapPin, Package, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Account" };

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

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");

  const [user, orders] = await Promise.all([
    db.user.findUnique({ where: { id: session.uid } }),
    db.order.findMany({
      where: { userId: session.uid },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { items: { take: 3 } },
    }),
  ]);
  if (!user) redirect("/login?next=/account");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-accent p-3.5 text-saffron-deep">
            <UserRound className="size-7" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">{user.name}</h1>
            <p className="text-sm text-muted-foreground">
              {user.email}
              {user.phone ? ` · ${user.phone}` : ""}
            </p>
          </div>
        </div>
        <form action={logoutAction}>
          <Button variant="outline" className="gap-2">
            <LogOut className="size-4" /> Log out
          </Button>
        </form>
      </div>

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
      </section>

      <section className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold">
          <MapPin className="size-5 text-saffron-deep" /> Addresses
        </h2>
        <p className="text-sm text-muted-foreground">
          Delivery addresses are managed during checkout — your saved addresses will be offered there.
        </p>
      </section>
    </div>
  );
}
