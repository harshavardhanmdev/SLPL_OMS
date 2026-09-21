export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Newspaper, Phone, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DispatchOne,
  EditAddress,
  PostingRun,
} from "@/components/erp/subscription-controls";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";
import { endsWithin, issueLabelFor } from "@/lib/subscription-plans";

export const metadata: Metadata = { title: "Subscriptions", robots: { index: false } };

const tone: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground border-border",
  ACTIVE: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
  COMPLETED: "bg-navy/10 text-navy border-navy/30 dark:text-foreground",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  REFUNDED: "bg-muted text-muted-foreground border-border",
};

const label: Record<string, string> = {
  PENDING: "Not paid",
  ACTIVE: "Active",
  COMPLETED: "Term finished",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

/** Active first, because that is the list someone actually works from. */
const rank: Record<string, number> = { ACTIVE: 0, PENDING: 1, COMPLETED: 2, CANCELLED: 3, REFUNDED: 4 };

const monthYear = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

export default async function SubscriptionsPage() {
  const staff = await getStaff();
  const canPost = staff ? roleCan(staff.role, "orders.manage") : false;
  const issue = issueLabelFor();

  const subs = await db.subscription.findMany({
    include: { dispatches: { orderBy: { sentAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  subs.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));

  const active = subs.filter((s) => s.status === "ACTIVE");
  const due = active.filter(
    (s) => s.issuesSent < s.issuesTotal && !s.dispatches.some((d) => d.issueLabel === issue),
  );
  const collected = subs
    .filter((s) => s.status === "ACTIVE" || s.status === "COMPLETED")
    .reduce((sum, s) => sum + s.amountPaid, 0);
  const soon = endsWithin(60);
  const ending = active.filter((s) => s.endsAt && s.endsAt <= soon).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            The GenZ Times, and who is owed the {issue} issue.
          </p>
        </div>
        <Button variant="outline" className="gap-2" asChild>
          <Link href="/erp/subscriptions/posting">
            <Printer className="size-4" /> Posting list
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Active subscribers", String(active.length), "paid and running"],
          ["Owed this issue", String(due.length), issue],
          ["Collected", formatINR(collected), "across every term"],
          ["Ending within 60 days", String(ending), "renewal notice goes out at 30"],
        ].map(([head, value, hint]) => (
          <div key={head} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{head}</p>
            <p className="font-heading text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {canPost && <PostingRun issue={issue} due={due.length} />}

      {subs.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Newspaper className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No subscriptions yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            They appear here the moment a reader pays at store.theslpl.in/subscribe.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {subs.map((s) => (
            <li key={s.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-semibold">
                    {s.subscriberName}
                    <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                      {s.code}
                    </span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="size-3.5" /> {s.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="size-3.5" /> {s.email}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={tone[s.status]}>{label[s.status] ?? s.status}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.issuesSent} of {s.issuesTotal} sent · {formatINR(s.amountPaid)}
                  </p>
                </div>
              </div>

              <p className="mt-2 text-sm">
                {s.addressLine1}
                {s.addressLine2 ? `, ${s.addressLine2}` : ""}, {s.city}, {s.state} - {s.pincode}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.termMonths} months from {s.startIssue}
                {s.endsAt ? ` to ${monthYear(s.endsAt)}` : ""}
                {s.dispatches.length > 0
                  ? ` · posted: ${s.dispatches.map((d) => d.issueLabel).join(", ")}`
                  : " · nothing posted yet"}
              </p>

              {canPost && s.status === "ACTIVE" && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <DispatchOne id={s.id} issue={issue} code={s.code} />
                  <EditAddress
                    address={{
                      id: s.id,
                      subscriberName: s.subscriberName,
                      phone: s.phone,
                      addressLine1: s.addressLine1,
                      addressLine2: s.addressLine2 ?? "",
                      city: s.city,
                      state: s.state,
                      pincode: s.pincode,
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
