import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isOwed } from "@/lib/subscription-plans";

/**
 * Parcel labels: what needs one, and what a printed label says.
 *
 * A label belongs to a store order, or to one issue of a GenZ Times
 * subscription. Its number is allocated the first time it is printed and kept
 * for every reprint, so the barcode on a parcel always finds the same record.
 */

/**
 * Store orders still to be sent: paid, couriered rather than collected at a
 * school, and holding at least one thing to post. A subscription is posted
 * issue by issue from its own list, and a digital edition is never posted.
 */
export const ORDERS_TO_SEND: Prisma.OrderWhereInput = {
  status: { in: ["PAID", "CONFIRMED", "PROCESSING"] },
  fulfilment: "SHIP",
  subscriptions: { none: {} },
  items: { some: { OR: [{ productId: null }, { product: { kind: { not: "DIGITAL" } } }] } },
};

/** HYD for Hyderabad and Secunderabad, otherwise the city's first three letters. */
export function cityCode(city: string, pincode: string): string {
  if (/hyderabad|secunderabad/i.test(city) || /^500\d{3}$/.test(pincode.trim())) return "HYD";
  return city
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

/** Everything the labels screen offers: who gets this issue, orders to send, recent labels. */
export async function labelQueue(issue: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [subs, orders, recent] = await Promise.all([
    db.subscription.findMany({
      // Owed the issue, or already marked as posted for it: a label can be
      // printed before the posting is recorded or after
      where: {
        OR: [
          { status: "ACTIVE", dispatches: { none: { issueLabel: issue } } },
          { status: { in: ["ACTIVE", "COMPLETED"] }, dispatches: { some: { issueLabel: issue } } },
        ],
      },
      include: {
        parcelLabels: { where: { issueLabel: issue }, select: { number: true } },
        dispatches: { where: { issueLabel: issue }, select: { sentAt: true } },
      },
      orderBy: [{ city: "asc" }, { pincode: "asc" }, { subscriberName: "asc" }],
    }),
    db.order.findMany({
      where: ORDERS_TO_SEND,
      include: {
        parcelLabel: { select: { number: true } },
        items: { select: { quantity: true, product: { select: { kind: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.parcelLabel.findMany({
      where: { createdAt: { gte: since } },
      include: {
        order: { select: { orderNumber: true, customerName: true } },
        subscription: { select: { code: true, subscriberName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return { subs: subs.filter((s) => s.dispatches.length > 0 || isOwed(s, issue)), orders, recent };
}

type AddressSnapshot = {
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string | null;
  landmark?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
};

export type PrintLabel = {
  id: string;
  number: string;
  /** ORDER or GENZ, printed before the reference */
  kind: string;
  reference: string;
  quantity: number;
  printedOn: Date;
  name: string;
  lines: string[];
  city: string;
  pincode: string;
  phone: string;
  cityCode: string;
  customerCode: string;
  contents: string;
};

/** The labels for `ids`, in that order, ready to print. */
export async function printableLabels(ids: string[]): Promise<PrintLabel[]> {
  const rows = await db.parcelLabel.findMany({
    where: { id: { in: ids } },
    include: {
      order: {
        include: {
          user: { select: { customerCode: true } },
          items: { include: { product: { select: { kind: true } } } },
        },
      },
      subscription: {
        include: {
          user: { select: { customerCode: true } },
          invoice: { select: { organization: { select: { code: true } } } },
        },
      },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  return ids.flatMap((id): PrintLabel[] => {
    const r = byId.get(id);
    if (!r) return [];
    if (r.order) {
      const o = r.order;
      const a = o.shippingAddress as AddressSnapshot;
      const goods = o.items.filter((i) => i.product?.kind !== "DIGITAL");
      const city = a.city ?? "";
      const pincode = a.pincode ?? "";
      return [
        {
          id: r.id,
          number: r.number,
          kind: "ORDER",
          reference: o.orderNumber,
          quantity: goods.reduce((n, i) => n + i.quantity, 0),
          printedOn: r.createdAt,
          name: a.fullName || o.customerName,
          lines: [a.line1, a.line2, a.landmark ? `Near ${a.landmark}` : null].filter((l): l is string => !!l),
          city,
          pincode,
          phone: a.phone || o.customerPhone,
          cityCode: cityCode(city, pincode),
          customerCode: o.user.customerCode ?? "",
          contents: goods.map((i) => `${i.quantity} x ${i.title}`).join(", "),
        },
      ];
    }
    if (r.subscription) {
      const s = r.subscription;
      return [
        {
          id: r.id,
          number: r.number,
          kind: "GENZ",
          reference: s.code,
          quantity: s.copies,
          printedOn: r.createdAt,
          name: s.subscriberName,
          lines: [s.addressLine1, s.addressLine2].filter((l): l is string => !!l),
          city: s.city,
          pincode: s.pincode,
          phone: s.phone,
          cityCode: cityCode(s.city, s.pincode),
          customerCode: s.invoice?.organization?.code ?? s.user?.customerCode ?? "",
          contents: `The GenZ Times, ${r.issueLabel} issue`,
        },
      ];
    }
    return [];
  });
}
