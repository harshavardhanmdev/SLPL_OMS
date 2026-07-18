import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  BadgeCheck,
  BookOpen,
  CircleAlert,
  Clock,
  ExternalLink,
  MapPin,
  Package,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AwbCopy } from "@/components/checkout/awb-copy";
import { CancelOrder } from "@/components/checkout/cancel-order";
import { OrderLive } from "@/components/checkout/order-live";
import { RetryPayment } from "@/components/checkout/retry-payment";
import { getSession } from "@/lib/auth";
import { getSetting } from "@/lib/catalog";
import { DEFAULT_TRACKING_URL } from "@/lib/site";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Order details" };

type Props = {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ placed?: string }>;
};

const statusMeta: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "info" }> = {
  AWAITING_PAYMENT: { label: "Awaiting payment", tone: "warn" },
  COD_PENDING_OTP: { label: "Awaiting COD confirmation", tone: "warn" },
  PAID: { label: "Paid - being packed", tone: "ok" },
  CONFIRMED: { label: "Confirmed (COD) - being packed", tone: "ok" },
  PAYMENT_FAILED: { label: "Payment failed", tone: "bad" },
  EXPIRED: { label: "Expired (unpaid)", tone: "bad" },
  PROCESSING: { label: "Packing", tone: "info" },
  SHIPPED: { label: "Shipped", tone: "info" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "ok" },
  CANCELLED: { label: "Cancelled", tone: "bad" },
  REFUNDED: { label: "Refunded", tone: "info" },
};

export default async function OrderDetailPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");

  const { orderNumber } = await params;
  const { placed } = await searchParams;

  const order = await db.order.findFirst({
    where: { orderNumber, userId: session.uid },
    include: {
      items: true,
      shipment: { include: { events: { orderBy: { occurredAt: "desc" }, take: 10 } } },
      events: { orderBy: { createdAt: "asc" } },
      payment: true,
    },
  });
  if (!order) notFound();

  const meta = statusMeta[order.status] ?? { label: order.status, tone: "info" as const };
  const addr = order.shippingAddress as {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <OrderLive orderNumber={order.orderNumber} status={order.status} placed={placed === "1"} />

      {placed === "1" && ["PAID", "CONFIRMED"].includes(order.status) && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border-2 border-green-600/30 bg-green-600/10 p-4">
          <BadgeCheck className="size-8 shrink-0 text-green-700 dark:text-green-400" />
          <div>
            <p className="font-heading font-semibold">Order placed successfully!</p>
            <p className="text-sm text-muted-foreground">
              A confirmation email is on its way to {order.customerEmail}.
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Order #{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Placed on{" "}
            {order.createdAt.toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <Badge
          className={
            meta.tone === "ok"
              ? "bg-green-600 text-white"
              : meta.tone === "warn"
                ? "bg-saffron text-navy"
                : meta.tone === "bad"
                  ? "bg-destructive text-white"
                  : "bg-primary text-primary-foreground"
          }
        >
          {meta.label}
        </Badge>
      </div>

      {order.status === "AWAITING_PAYMENT" && (
        <div className="mb-6 flex flex-wrap items-start gap-3 rounded-xl border border-saffron/50 bg-accent/60 p-4 text-sm">
          <Clock className="mt-0.5 size-5 shrink-0 text-saffron-deep" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Waiting for your payment to confirm.</p>
            <p className="mt-0.5 text-muted-foreground">
              If you completed the payment, this page will update automatically within a few
              minutes - interrupted payments are auto-confirmed or auto-refunded, never lost.
              If you closed the payment window, you can finish paying now.
            </p>
            <div className="mt-3">
              <RetryPayment orderNumber={order.orderNumber} />
            </div>
          </div>
        </div>
      )}
      {["PAYMENT_FAILED", "EXPIRED"].includes(order.status) && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">This order was not completed.</p>
            <p className="mt-0.5 text-muted-foreground">
              Any deducted amount is auto-refunded by the bank within 5-7 working days. Add the
              items to your cart again to reorder.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <section className="space-y-4">
          <div className="rounded-2xl border bg-card">
            <h2 className="flex items-center gap-2 border-b p-4 font-heading font-semibold">
              <Package className="size-4 text-saffron-deep" /> Items
            </h2>
            <ul className="divide-y">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 p-4">
                  <span className="relative block h-16 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {item.image ? (
                      <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center">
                        <BookOpen className="size-5 text-muted-foreground/40" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatINR(item.unitPrice)} × {item.quantity}
                    </span>
                  </span>
                  <span className="font-medium">{formatINR(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 border-t p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatINR(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-700 dark:text-green-400">
                  <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                  <span>−{formatINR(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{order.shippingFee === 0 ? "Free" : formatINR(order.shippingFee)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-heading text-base font-bold">
                <span>Total</span>
                <span>{formatINR(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Tracking */}
          <div className="rounded-2xl border bg-card">
            <h2 className="flex items-center gap-2 border-b p-4 font-heading font-semibold">
              <Truck className="size-4 text-saffron-deep" /> Delivery
            </h2>
            <div className="p-4">
              {order.shipment?.awb ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Courier:</span>{" "}
                    <b>{order.shipment.courierName ?? "Assigned"}</b>
                    <span className="text-muted-foreground">· Tracking number:</span>
                    <AwbCopy awb={order.shipment.awb} />
                  </div>
                  <Button size="sm" className="gap-2" asChild>
                    <a
                      href={
                        order.shipment.trackingUrl ??
                        (await getSetting("tracking_url_template", DEFAULT_TRACKING_URL))
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Track on courier page <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Tap the number to copy it, then paste it on the courier&apos;s tracking page.
                  </p>
                  {order.shipment.events.length > 0 && (
                    <ul className="space-y-2 border-l-2 border-border pl-4 text-sm">
                      {order.shipment.events.map((ev) => (
                        <li key={ev.id}>
                          <p className="font-medium">{ev.description ?? ev.status}</p>
                          <p className="text-xs text-muted-foreground">
                            {ev.location ? `${ev.location} · ` : ""}
                            {ev.occurredAt.toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tracking details will appear here once your order ships - we will also email
                  you the tracking link.
                </p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border bg-card">
            <h2 className="border-b p-4 font-heading font-semibold">Order timeline</h2>
            <ul className="space-y-3 p-4">
              {order.events.map((ev) => (
                <li key={ev.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-saffron" />
                  <span>
                    <span className="font-medium">{statusMeta[ev.status]?.label ?? ev.status}</span>
                    {ev.note && <span className="text-muted-foreground"> - {ev.note}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {ev.createdAt.toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="h-fit space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="mb-2 flex items-center gap-2 font-heading font-semibold">
              <MapPin className="size-4 text-saffron-deep" /> Delivering to
            </h2>
            <p className="text-sm font-medium">{addr.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}
              {addr.landmark ? `, near ${addr.landmark}` : ""}
              <br />
              {addr.city}, {addr.state} - {addr.pincode}
              <br />
              {addr.phone}
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 text-sm">
            <h2 className="mb-2 font-heading font-semibold">Payment</h2>
            <p className="text-muted-foreground">
              {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online (Razorpay)"}
              {order.payment?.method ? ` · ${order.payment.method}` : ""}
            </p>
            <p className="mt-1 font-medium">{formatINR(order.total)}</p>
          </div>
          {["AWAITING_PAYMENT", "COD_PENDING_OTP", "PAID", "CONFIRMED", "PROCESSING"].includes(order.status) &&
            !order.shipment?.awb && (
              <CancelOrder
                orderNumber={order.orderNumber}
                paid={order.payment?.status === "CAPTURED"}
              />
            )}
          <Button variant="outline" className="w-full" asChild>
            <Link href="/account">Back to my orders</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
