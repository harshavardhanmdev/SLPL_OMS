export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, MessageSquare, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GrievanceReply } from "@/components/store/grievance-reply";
import { db } from "@/lib/db";
import { categoryLabel, getGrievanceOfficer, grievanceStatusMeta, toneClass } from "@/lib/grievances";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Your complaint", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

const dateIN = (d: Date) =>
  d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function GrievanceTrackPage({ params }: Props) {
  const { token } = await params;

  const grievance = await db.grievance.findUnique({
    where: { accessToken: token },
    include: {
      order: { select: { orderNumber: true } },
      // Internal notes stay internal
      events: { where: { visibleToCustomer: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!grievance) notFound();

  const officer = await getGrievanceOfficer();
  const meta = grievanceStatusMeta[grievance.status] ?? { label: grievance.status, tone: "info" as const };
  const isClosed = ["RESOLVED", "CLOSED"].includes(grievance.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Complaint {grievance.ticketNumber}</h1>
          <p className="text-sm text-muted-foreground">Filed on {dateIN(grievance.createdAt)}</p>
        </div>
        <Badge className={toneClass(meta.tone)}>{meta.label}</Badge>
      </div>

      {grievance.status === "AWAITING_CUSTOMER" && (
        <div className="mb-6 rounded-xl border border-saffron/50 bg-accent/60 p-4 text-sm">
          <p className="font-medium">We are waiting on you.</p>
          <p className="mt-0.5 text-muted-foreground">
            Please read our latest message below and reply so we can carry on.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <section className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-heading font-semibold">{grievance.subject}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{categoryLabel(grievance.category)}</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{grievance.description}</p>
            {(grievance.order || grievance.orderRef || grievance.paymentRef || grievance.amountClaimed) && (
              <dl className="mt-4 space-y-1 border-t pt-3 text-sm text-muted-foreground">
                {(grievance.order?.orderNumber || grievance.orderRef) && (
                  <div>
                    Order: <b className="text-foreground">{grievance.order?.orderNumber ?? grievance.orderRef}</b>
                  </div>
                )}
                {grievance.paymentRef && (
                  <div>
                    Payment reference: <b className="text-foreground">{grievance.paymentRef}</b>
                  </div>
                )}
                {grievance.amountClaimed != null && (
                  <div>
                    Amount in dispute: <b className="text-foreground">{formatINR(grievance.amountClaimed)}</b>
                  </div>
                )}
              </dl>
            )}
          </div>

          <div className="rounded-2xl border bg-card">
            <h2 className="border-b p-4 font-heading font-semibold">Progress</h2>
            <ul className="space-y-3 p-4">
              {grievance.events.map((ev) => (
                <li key={ev.id} className="flex gap-3 text-sm">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${ev.byAdmin ? "bg-saffron" : "bg-muted-foreground/50"}`}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">
                      {ev.status === "CUSTOMER_REPLY"
                        ? "Your reply"
                        : (grievanceStatusMeta[ev.status]?.label ?? ev.status.replaceAll("_", " "))}
                    </span>
                    {ev.note && <span className="block whitespace-pre-line text-muted-foreground">{ev.note}</span>}
                    <span className="block text-xs text-muted-foreground">{dateIN(ev.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {!isClosed && (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
                <MessageSquare className="size-4 text-saffron-deep" /> Reply to us
              </h2>
              <GrievanceReply token={token} />
            </div>
          )}
        </section>

        <aside className="h-fit space-y-4">
          <div className="rounded-2xl border bg-card p-4 text-sm">
            <h2 className="mb-2 flex items-center gap-2 font-heading font-semibold">
              <CalendarClock className="size-4 text-saffron-deep" /> Our timeline
            </h2>
            <p className="text-muted-foreground">
              Acknowledge by
              <br />
              <b className="text-foreground">{dateIN(grievance.ackDueAt)}</b>
            </p>
            <p className="mt-2 text-muted-foreground">
              Resolve by
              <br />
              <b className="text-foreground">{dateIN(grievance.dueAt)}</b>
            </p>
          </div>

          <div className="rounded-2xl border bg-secondary/60 p-4 text-sm dark:bg-card">
            <h2 className="mb-2 font-heading font-semibold">Grievance Officer</h2>
            <p className="text-muted-foreground">
              {officer.name}
              <br />
              <a href={`mailto:${officer.email}`} className="break-all hover:underline">
                {officer.email}
              </a>
            </p>
            <a
              href={`tel:${officer.phone.replace(/\s/g, "")}`}
              className="mt-2 flex items-center gap-2 font-medium hover:underline"
            >
              <Phone className="size-4 text-saffron-deep" /> {officer.phone}
            </a>
            <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
              <Link href="/policies/grievance">Escalation options</Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
