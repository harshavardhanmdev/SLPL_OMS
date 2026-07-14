import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OrderActions } from "@/components/admin/order-actions";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { isShiprocketConfigured } from "@/lib/shipping/shiprocket";

export const metadata: Metadata = { title: "Admin · Order", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderNumber: string }> };

export default async function AdminOrderDetailPage({ params }: Props) {
  const { orderNumber } = await params;
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      payment: true,
      shipment: { include: { events: { orderBy: { occurredAt: "desc" } } } },
      events: { orderBy: { createdAt: "asc" } },
      user: { select: { email: true } },
    },
  });
  if (!order) notFound();

  const addr = order.shippingAddress as {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
    lat: number | null;
    lng: number | null;
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/orders" aria-label="Back to orders">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold">#{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {order.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <Badge className="bg-primary text-primary-foreground">{order.status.replaceAll("_", " ")}</Badge>
      </div>

      <OrderActions
        orderNumber={order.orderNumber}
        status={order.status}
        shiprocketEnabled={isShiprocketConfigured()}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 font-heading font-semibold">Customer</h2>
          <p className="text-sm">
            {order.customerName}
            <br />
            <a href={`mailto:${order.customerEmail}`} className="text-muted-foreground underline-offset-2 hover:underline">
              {order.customerEmail}
            </a>
            <br />
            <a href={`tel:${order.customerPhone}`} className="text-muted-foreground underline-offset-2 hover:underline">
              {order.customerPhone}
            </a>
          </p>
          <Separator className="my-3" />
          <h3 className="mb-1 text-sm font-semibold">Ship to</h3>
          <p className="text-sm text-muted-foreground">
            {addr.fullName}, {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ""}
            {addr.landmark ? `, near ${addr.landmark}` : ""}
            <br />
            {addr.city}, {addr.state} — <b className="text-foreground">{addr.pincode}</b>
          </p>
          {addr.lat != null && addr.lng != null && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${addr.lat}&mlon=${addr.lng}#map=17/${addr.lat}/${addr.lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-saffron-deep hover:underline"
            >
              Pinned doorstep on map <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 font-heading font-semibold">Payment</h2>
          <p className="text-sm text-muted-foreground">
            {order.paymentMethod === "COD" ? "Cash on Delivery" : "Razorpay"} ·{" "}
            {order.payment?.status.toLowerCase()}
            {order.payment?.razorpayPaymentId && (
              <>
                <br />
                Payment ID: <code className="text-xs">{order.payment.razorpayPaymentId}</code>
              </>
            )}
          </p>
          <Separator className="my-3" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatINR(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-700 dark:text-green-400">
                <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
                <span>−{formatINR(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span>
              <span>{formatINR(order.shippingFee)}</span>
            </div>
            <div className="flex justify-between font-heading font-bold">
              <span>Total</span>
              <span>{formatINR(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card">
        <h2 className="border-b p-4 font-heading font-semibold">Items to pack</h2>
        <ul className="divide-y">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <span>
                {item.title} <b>× {item.quantity}</b>
              </span>
              <span className="font-medium">{formatINR(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>

      {order.shipment && (
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 font-heading font-semibold">Shipment</h2>
          <p className="text-sm text-muted-foreground">
            {order.shipment.courierName} · AWB {order.shipment.awb}
            {order.shipment.trackingUrl && (
              <>
                {" · "}
                <a href={order.shipment.trackingUrl} target="_blank" rel="noreferrer" className="text-saffron-deep hover:underline">
                  tracking link
                </a>
              </>
            )}
          </p>
        </div>
      )}

      <div className="rounded-2xl border bg-card">
        <h2 className="border-b p-4 font-heading font-semibold">Timeline</h2>
        <ul className="space-y-2.5 p-4 text-sm">
          {order.events.map((ev) => (
            <li key={ev.id} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-saffron" />
              <span>
                <b>{ev.status.replaceAll("_", " ")}</b>
                {ev.note && <span className="text-muted-foreground"> — {ev.note}</span>}
                <span className="block text-xs text-muted-foreground">
                  {ev.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
