export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ChevronRight, FileSignature, Package, ReceiptText } from "lucide-react";

import { approvalFilters } from "@/lib/approvals";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Approvals", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

type Item = {
  key: string;
  kind: "Quotation" | "Invoice" | "Samples";
  title: string;
  href: string;
  raisedBy: string;
  school: string;
  amount: string;
  when: Date;
  reason: string | null;
};

const icons = { Quotation: FileSignature, Invoice: ReceiptText, Samples: Package };

/**
 * One inbox for everything that needs a decision. The manager sees what is
 * waiting on him; an executive sees what came back, and why, so nothing sits
 * unnoticed in a list they do not open.
 */
export default async function ApprovalsPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");
  const f = approvalFilters(staff);

  const [quotations, invoices, samples] = await Promise.all([
    db.quotation.findMany({
      where: f.quotation,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        createdBy: { select: { name: true } },
        organization: { select: { name: true } },
      },
    }),
    db.invoice.findMany({
      where: f.invoice,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        createdBy: { select: { name: true } },
        organization: { select: { name: true } },
      },
    }),
    db.sampleIssue.findMany({
      where: f.sample,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        issuedBy: { select: { name: true } },
        organization: { select: { name: true } },
      },
    }),
  ]);

  const items: Item[] = [
    ...quotations.map((q) => ({
      key: `q-${q.id}`,
      kind: "Quotation" as const,
      title: q.number,
      href: `/erp/quotations/${q.id}`,
      raisedBy: q.createdBy?.name ?? q.createdEmail,
      school: q.organization?.name ?? q.customerName,
      amount: formatINR(q.total),
      when: q.updatedAt,
      reason: q.rejectedReason,
    })),
    ...invoices.map((i) => ({
      key: `i-${i.id}`,
      kind: "Invoice" as const,
      title: i.number,
      href: `/erp/invoices/${i.id}`,
      raisedBy: i.createdBy?.name ?? i.createdEmail,
      school: i.organization?.name ?? i.customerName,
      amount: formatINR(i.total),
      when: i.updatedAt,
      reason: i.rejectedReason,
    })),
    ...samples.map((s) => ({
      key: `s-${s.id}`,
      kind: "Samples" as const,
      title: s.description,
      href: "/erp/samples",
      raisedBy: s.issuedBy?.name ?? s.issuedEmail,
      school: s.organization?.name ?? "Not with a school yet",
      amount: `${s.quantity} ${s.quantity === 1 ? "copy" : "copies"}`,
      when: s.updatedAt,
      reason: s.rejectedReason,
    })),
  ].sort((a, b) => b.when.getTime() - a.when.getTime());

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          {f.approver
            ? "Quotations, invoices and samples waiting for your decision, newest first."
            : "What your manager sent back to you, and why. Fix it and save to send it again."}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <CheckCircle2 className="mx-auto size-10 text-green-600" />
          <p className="mt-3 font-heading text-lg font-semibold">All clear</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {f.approver
              ? "Nothing is waiting for you. New requests from the team will show up here."
              : "Nothing has been sent back to you. Keep going."}
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {items.map((item) => {
            const Icon = icons[item.kind];
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/40"
                >
                  <Icon className="size-5 shrink-0 text-saffron-deep" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {item.kind}
                      </span>{" "}
                      {item.title}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {item.school} · {item.raisedBy} · {dateIN(item.when)}
                    </p>
                    {item.reason && (
                      <p className="mt-1 text-sm text-destructive">Sent back: {item.reason}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-heading font-semibold tabular-nums">{item.amount}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
