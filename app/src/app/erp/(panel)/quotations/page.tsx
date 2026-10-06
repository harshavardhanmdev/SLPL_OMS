export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSignature, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Quotations", robots: { index: false } };

const tone: Record<string, string> = {
  DRAFT: "bg-destructive/10 text-destructive border-destructive/30",
  PENDING_APPROVAL: "bg-saffron/15 text-saffron-deep border-saffron/40",
  APPROVED: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200",
  SENT: "bg-saffron/20 text-saffron-deep border-saffron/40",
  ACCEPTED: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
  REJECTED: "bg-muted text-muted-foreground border-border",
  EXPIRED: "bg-muted text-muted-foreground border-border",
};

const label: Record<string, string> = {
  DRAFT: "Sent back",
  PENDING_APPROVAL: "Needs approval",
  APPROVED: "Approved",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Not taken up",
  EXPIRED: "Lapsed",
};

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function QuotationsPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "quotes.read")) redirect("/erp");
  const canWrite = roleCan(staff.role, "quotes.write");

  const quotations = await db.quotation.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { createdBy: { select: { name: true } }, _count: { select: { items: true } } },
  });

  const open = quotations.filter((q) =>
    ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"].includes(q.status),
  );
  const won = quotations.filter((q) => q.status === "ACCEPTED");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Quotations</h1>
          <p className="text-sm text-muted-foreground">
            What we have offered schools, on letterhead, with GST worked out line by line.
          </p>
        </div>
        {canWrite && (
          <Button className="gap-2" asChild>
            <Link href="/erp/quotations/new">
              <Plus className="size-4" /> New quotation
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Open", String(open.length), "not yet decided by the school"],
          ["Value out", formatINR(open.reduce((s, q) => s + q.total, 0)), "sitting with schools"],
          ["Accepted", String(won.length), "turned into orders"],
          ["Won value", formatINR(won.reduce((s, q) => s + q.total, 0)), "across all time"],
        ].map(([head, value, hint]) => (
          <div key={head} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{head}</p>
            <p className="font-heading text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {quotations.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <FileSignature className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No quotations yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canWrite
              ? "Raise the first one for a school."
              : "Your sales manager raises these. You will see them here."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {quotations.map((q) => (
            <li key={q.id}>
              <Link
                href={`/erp/quotations/${q.id}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 transition hover:border-saffron"
              >
                <div>
                  <p className="font-heading font-semibold">{q.customerName}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{q.number}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateIN(q.quotedOn)} · {q._count.items}{" "}
                    {q._count.items === 1 ? "line" : "lines"} · valid to {dateIN(q.validUntil)}
                    {q.createdBy ? ` · ${q.createdBy.name}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={tone[q.status]}>{label[q.status] ?? q.status}</Badge>
                  <p className="mt-1 font-heading font-bold">{formatINR(q.total)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
