import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard, EyeOff, Lock, Mail, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { GrievanceActions } from "@/components/admin/grievance-actions";
import { db } from "@/lib/db";
import {
  categoryLabel,
  grievanceStatusMeta,
  isAckOverdue,
  isResolutionOverdue,
  toneClass,
} from "@/lib/grievances";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Admin · Grievance", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ ticketNumber: string }> };

const dateIN = (d: Date) =>
  d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function AdminGrievanceDetailPage({ params }: Props) {
  const { ticketNumber } = await params;

  const g = await db.grievance.findUnique({
    where: { ticketNumber },
    include: {
      user: { select: { id: true, email: true, name: true } },
      // Payment details ride along so a money complaint is diagnosable here
      order: { include: { payment: true, items: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!g) notFound();

  const meta = grievanceStatusMeta[g.status] ?? { label: g.status, tone: "info" as const };
  const ackLate = isAckOverdue(g);
  const resolutionLate = isResolutionOverdue(g);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/grievances" aria-label="Back to grievances">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold">{g.ticketNumber}</h1>
            <p className="text-sm text-muted-foreground">Filed {dateIN(g.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {g.priority !== "NORMAL" && <Badge className="bg-saffron text-navy">{g.priority.toLowerCase()}</Badge>}
          <Badge className={toneClass(meta.tone)}>{meta.label}</Badge>
        </div>
      </div>

      {(ackLate || resolutionLate) && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">
            {ackLate ? "Acknowledgement is overdue." : "This complaint is past the 30 day resolution window."}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {ackLate
              ? `The 48 hour deadline was ${dateIN(g.ackDueAt)}. Acknowledge it now.`
              : `The deadline was ${dateIN(g.dueAt)}. Resolve or escalate today.`}
          </p>
        </div>
      )}

      <GrievanceActions ticketNumber={g.ticketNumber} status={g.status} />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 font-heading font-semibold">Complainant</h2>
          <p className="text-sm">
            {g.contactName}
            {g.user ? (
              <Badge variant="secondary" className="ml-2">
                registered customer
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-2">
                guest
              </Badge>
            )}
            <br />
            <a
              href={`mailto:${g.contactEmail}`}
              className="flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:underline"
            >
              <Mail className="size-3.5" /> {g.contactEmail}
            </a>
            {g.contactPhone && (
              <a
                href={`tel:${g.contactPhone}`}
                className="flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:underline"
              >
                <Phone className="size-3.5" /> {g.contactPhone}
              </a>
            )}
          </p>
          <Separator className="my-3" />
          <h3 className="mb-1 text-sm font-semibold">Our deadlines</h3>
          <p className="text-sm text-muted-foreground">
            Acknowledge by <b className={ackLate ? "text-destructive" : "text-foreground"}>{dateIN(g.ackDueAt)}</b>
            <br />
            Resolve by{" "}
            <b className={resolutionLate ? "text-destructive" : "text-foreground"}>{dateIN(g.dueAt)}</b>
            {g.acknowledgedAt && (
              <>
                <br />
                Acknowledged {dateIN(g.acknowledgedAt)}
              </>
            )}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-heading font-semibold">
            <CreditCard className="size-4 text-saffron-deep" /> Payment and order
          </h2>
          {g.order ? (
            <div className="space-y-1 text-sm">
              <p>
                <Link
                  href={`/admin/orders/${g.order.orderNumber}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {g.order.orderNumber}
                </Link>{" "}
                <Badge variant="secondary">{g.order.status.replaceAll("_", " ").toLowerCase()}</Badge>
              </p>
              <p className="text-muted-foreground">
                {g.order.items.length} item{g.order.items.length === 1 ? "" : "s"} ·{" "}
                {formatINR(g.order.total)} · {g.order.paymentMethod === "COD" ? "Cash on Delivery" : "Razorpay"}
              </p>
              {g.order.payment && (
                <>
                  <p className="text-muted-foreground">
                    Payment: <b className="text-foreground">{g.order.payment.status.toLowerCase()}</b>
                    {g.order.payment.method ? ` · ${g.order.payment.method}` : ""}
                    {g.order.payment.refundedAmount > 0
                      ? ` · refunded ${formatINR(g.order.payment.refundedAmount)}`
                      : ""}
                  </p>
                  {g.order.payment.razorpayPaymentId && (
                    <p className="break-all text-muted-foreground">
                      Razorpay payment id: <code className="text-xs">{g.order.payment.razorpayPaymentId}</code>
                    </p>
                  )}
                  {g.order.payment.razorpayOrderId && (
                    <p className="break-all text-muted-foreground">
                      Razorpay order id: <code className="text-xs">{g.order.payment.razorpayOrderId}</code>
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {g.orderRef
                ? `Customer quoted order "${g.orderRef}" but it did not match any order on their email. Check manually.`
                : "No order linked. This may be a payment that never created an order."}
            </p>
          )}
          {(g.paymentRef || g.amountClaimed != null) && (
            <>
              <Separator className="my-3" />
              <h3 className="mb-1 text-sm font-semibold">Customer supplied</h3>
              <p className="text-sm text-muted-foreground">
                {g.paymentRef && (
                  <>
                    Reference: <b className="break-all text-foreground">{g.paymentRef}</b>
                    <br />
                  </>
                )}
                {g.amountClaimed != null && (
                  <>
                    Amount disputed: <b className="text-foreground">{formatINR(g.amountClaimed)}</b>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h2 className="font-heading font-semibold">{g.subject}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{categoryLabel(g.category)}</p>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{g.description}</p>
      </div>

      {g.resolution && (
        <div className="rounded-2xl border border-green-600/40 bg-green-600/10 p-4">
          <h2 className="font-heading font-semibold">Resolution</h2>
          <p className="mt-1 whitespace-pre-line text-sm">{g.resolution}</p>
          {g.resolvedAt && (
            <p className="mt-2 text-xs text-muted-foreground">Resolved {dateIN(g.resolvedAt)}</p>
          )}
        </div>
      )}

      <div className="rounded-2xl border bg-card">
        <h2 className="border-b p-4 font-heading font-semibold">Timeline</h2>
        <ul className="space-y-3 p-4 text-sm">
          {g.events.map((ev) => (
            <li key={ev.id} className="flex gap-3">
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${ev.byAdmin ? "bg-saffron" : "bg-muted-foreground/50"}`}
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <b>
                    {ev.status === "CUSTOMER_REPLY"
                      ? "Customer replied"
                      : ev.status === "NOTE"
                        ? "Internal note"
                        : (grievanceStatusMeta[ev.status]?.label ?? ev.status.replaceAll("_", " "))}
                  </b>
                  {!ev.visibleToCustomer && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      <EyeOff className="size-3" /> internal
                    </span>
                  )}
                </span>
                {ev.note && <span className="block whitespace-pre-line text-muted-foreground">{ev.note}</span>}
                <span className="block text-xs text-muted-foreground">{dateIN(ev.createdAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" /> The customer follows this complaint on a private tracking link
        sent to {g.contactEmail}.
      </p>
    </div>
  );
}
