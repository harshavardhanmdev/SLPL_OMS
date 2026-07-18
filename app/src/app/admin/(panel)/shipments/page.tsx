import type { Metadata } from "next";
import Link from "next/link";
import { CheckCheck, PackageCheck, PackageOpen, Send, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { OrderActions } from "@/components/admin/order-actions";
import { getSetting } from "@/lib/catalog";
import { DEFAULT_TRACKING_URL } from "@/lib/site";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { isShiprocketConfigured } from "@/lib/shipping/shiprocket";

export const metadata: Metadata = { title: "Admin · Shipments", robots: { index: false } };
export const dynamic = "force-dynamic";

type Stage = {
  key: string;
  title: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  statuses: string[];
};

const STAGES: Stage[] = [
  {
    key: "to-pack",
    title: "To pack",
    hint: "Payment confirmed - pack the books and press Start packing.",
    icon: PackageOpen,
    statuses: ["PAID", "CONFIRMED"],
  },
  {
    key: "packing",
    title: "Packing",
    hint: "When the DTDC agent picks it up, press Ship and enter the consignment number.",
    icon: PackageCheck,
    statuses: ["PROCESSING"],
  },
  {
    key: "in-transit",
    title: "In transit",
    hint: "With the courier - advance when DTDC shows out for delivery.",
    icon: Send,
    statuses: ["SHIPPED"],
  },
  {
    key: "out-for-delivery",
    title: "Out for delivery",
    hint: "Mark delivered once the customer has it.",
    icon: Truck,
    statuses: ["OUT_FOR_DELIVERY"],
  },
];

const daysAgo = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86400000);

export default async function AdminShipmentsPage() {
  const activeStatuses = STAGES.flatMap((s) => s.statuses);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [active, delivered, trackingUrlDefault] = await Promise.all([
    db.order.findMany({
      where: { status: { in: activeStatuses as never } },
      orderBy: { createdAt: "asc" },
      include: { shipment: true, _count: { select: { items: true } } },
    }),
    db.order.findMany({
      where: { status: "DELIVERED", updatedAt: { gte: weekAgo } },
      orderBy: { updatedAt: "desc" },
      include: { shipment: true, _count: { select: { items: true } } },
    }),
    getSetting("tracking_url_template", DEFAULT_TRACKING_URL),
  ]);
  const shiprocketEnabled = isShiprocketConfigured();

  const row = (order: (typeof active)[number]) => {
    const addr = order.shippingAddress as { city?: string; pincode?: string };
    const age = daysAgo(order.createdAt);
    return (
      <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/orders/${order.orderNumber}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              #{order.orderNumber}
            </Link>
            <Badge variant="secondary">
              {order.paymentMethod === "COD" ? "COD" : "Paid online"}
            </Badge>
            {age >= 2 && ["PAID", "CONFIRMED", "PROCESSING"].includes(order.status) && (
              <Badge className="bg-destructive text-white">{age} days old</Badge>
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {order.customerName} · {addr.city ?? ""} {addr.pincode ?? ""} ·{" "}
            {order._count.items} item{order._count.items === 1 ? "" : "s"} ·{" "}
            {formatINR(order.total)}
            {order.shipment?.awb && (
              <>
                {" · "}
                <span className="font-medium text-foreground">
                  {order.shipment.courierName} {order.shipment.awb}
                </span>
              </>
            )}
          </p>
        </div>
        <OrderActions
          orderNumber={order.orderNumber}
          status={order.status}
          shiprocketEnabled={shiprocketEnabled}
          trackingUrlDefault={trackingUrlDefault}
          compact
        />
      </li>
    );
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Shipments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every order on its way to a customer, from packing shelf to doorstep.
        </p>
      </div>

      {STAGES.map(({ key, title, hint, icon: Icon, statuses }) => {
        const orders = active.filter((o) => statuses.includes(o.status));
        return (
          <section key={key} className="rounded-2xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b p-4">
              <h2 className="flex items-center gap-2 font-heading font-semibold">
                <Icon className="size-4 text-saffron-deep" /> {title}
                <Badge variant={orders.length > 0 ? "default" : "secondary"}>{orders.length}</Badge>
              </h2>
              <p className="hidden text-xs text-muted-foreground sm:block">{hint}</p>
            </div>
            {orders.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nothing here right now.</p>
            ) : (
              <ul className="divide-y">{orders.map(row)}</ul>
            )}
          </section>
        );
      })}

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <h2 className="flex items-center gap-2 font-heading font-semibold">
            <CheckCheck className="size-4 text-green-700 dark:text-green-400" /> Delivered (last 7
            days)
            <Badge variant="secondary">{delivered.length}</Badge>
          </h2>
        </div>
        {delivered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No deliveries in the last week.</p>
        ) : (
          <ul className="divide-y">
            {delivered.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
                <Link
                  href={`/admin/orders/${order.orderNumber}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  #{order.orderNumber}
                </Link>
                <span className="text-muted-foreground">
                  {order.customerName} · {formatINR(order.total)}
                  {order.shipment?.awb ? ` · ${order.shipment.courierName} ${order.shipment.awb}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
