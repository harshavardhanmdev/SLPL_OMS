export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "My subscriptions" };

const tone: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground border-border",
  ACTIVE: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
  COMPLETED: "bg-navy/10 text-navy border-navy/30 dark:text-foreground",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  REFUNDED: "bg-muted text-muted-foreground border-border",
};

const label: Record<string, string> = {
  PENDING: "Awaiting payment",
  ACTIVE: "Active",
  COMPLETED: "Term finished",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export default async function MySubscriptionsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/subscriptions");

  const subs = await db.subscription.findMany({
    where: { OR: [{ userId: session.uid }, { order: { userId: session.uid } }] },
    include: { dispatches: { orderBy: { sentAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-1 font-heading text-2xl font-bold">My subscriptions</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        The GenZ Times, and which issues have gone out so far.
      </p>

      {subs.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <Newspaper className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No subscriptions yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Subscribe once and every issue is posted as it prints.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/subscribe">See the plans</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {subs.map((s) => (
            <li key={s.id} className="rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-semibold">
                    The GenZ Times · {s.termMonths} months
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {s.code} · {formatINR(s.amountPaid)} · from {s.startIssue}
                  </p>
                </div>
                <Badge className={tone[s.status]}>{label[s.status] ?? s.status}</Badge>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">Issues sent</span>
                  <span className="font-medium">
                    {s.issuesSent} of {s.issuesTotal}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-saffron"
                    style={{ width: `${Math.round((s.issuesSent / s.issuesTotal) * 100)}%` }}
                  />
                </div>
              </div>

              {s.dispatches.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Posted: {s.dispatches.map((d) => d.issueLabel).join(", ")}
                </p>
              )}

              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                Posting to {s.addressLine1}
                {s.addressLine2 ? `, ${s.addressLine2}` : ""}, {s.city}, {s.state} - {s.pincode}.
                Reply to your welcome email with {s.code} to change it.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
