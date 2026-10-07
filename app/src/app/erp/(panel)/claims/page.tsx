export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ClaimDecision, ClaimForm, WithdrawClaim } from "@/components/erp/claim-controls";
import { claimCategoryLabel } from "@/lib/claims";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = {
  title: "My expenses",
  robots: { index: false },
};

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

type Claim = {
  id: string;
  spentOn: Date;
  amount: number;
  category: string;
  note: string;
  billImage: string | null;
  status: string;
  decidedByName: string | null;
  rejectedReason: string | null;
  claimedBy?: { name: string };
};

function StatusNote({ c }: { c: Claim }) {
  if (c.status === "PENDING") {
    return (
      <span className="rounded-full border border-saffron/40 bg-saffron/10 px-2 py-0.5 text-xs font-medium text-saffron-deep">
        Waiting for approval
      </span>
    );
  }
  if (c.status === "REJECTED") {
    return (
      <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        Sent back{c.rejectedReason ? `: ${c.rejectedReason}` : ""}
      </span>
    );
  }
  return (
    <span className="rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      Approved{c.decidedByName ? ` by ${c.decidedByName}` : ""}
    </span>
  );
}

function ClaimRow({ c, children }: { c: Claim; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {c.claimedBy ? `${c.claimedBy.name} · ` : ""}
          {claimCategoryLabel(c.category)}
          <span className="font-normal text-muted-foreground"> · {dateIN(c.spentOn)}</span>
        </p>
        <p className="text-sm text-muted-foreground">{c.note}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusNote c={c} />
          {c.billImage && (
            <a href={c.billImage} target="_blank" rel="noreferrer" className="text-xs underline">
              Bill photo
            </a>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className="font-heading font-semibold tabular-nums">{formatINR(c.amount)}</span>
        {children}
      </div>
    </li>
  );
}

/**
 * Travel, fuel or food a person paid for themselves, claimed here and sent to
 * an owner. Everyone sees their own claims; an owner also sees what is waiting.
 */
export default async function ClaimsPage() {
  const staff = await getStaff();
  if (!staff) redirect("/erp/signin?next=/erp/claims");
  const owner = roleCan(staff.role, "staff.manage");

  const [mine, waiting, approved] = await Promise.all([
    staff.breakGlass
      ? []
      : db.expenseClaim.findMany({
          where: { claimedById: staff.id },
          orderBy: { spentOn: "desc" },
          take: 100,
        }),
    owner
      ? db.expenseClaim.findMany({
          where: { status: "PENDING", NOT: { claimedById: staff.id } },
          orderBy: { createdAt: "asc" },
          include: { claimedBy: { select: { name: true } } },
        })
      : [],
    owner
      ? db.expenseClaim.findMany({
          where: { status: "APPROVED" },
          orderBy: { decidedAt: "desc" },
          take: 30,
          include: { claimedBy: { select: { name: true } } },
        })
      : [],
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">My expenses</h1>
        <p className="text-sm text-muted-foreground">
          Travel, fuel or food you paid for yourself. Send it here and an owner approves it.
        </p>
      </div>

      {owner && (
        <section className="rounded-2xl border bg-card">
          <h2 className="border-b p-4 font-heading font-semibold">Waiting for you</h2>
          {waiting.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No claims waiting.</p>
          ) : (
            <ul className="divide-y">
              {waiting.map((c) => (
                <ClaimRow key={c.id} c={c}>
                  <ClaimDecision
                    id={c.id}
                    title={`${c.claimedBy.name}'s ${claimCategoryLabel(c.category)} claim`}
                  />
                </ClaimRow>
              ))}
            </ul>
          )}
        </section>
      )}

      {!staff.breakGlass && <ClaimForm />}

      {!staff.breakGlass && (
        <section className="rounded-2xl border bg-card">
          <h2 className="border-b p-4 font-heading font-semibold">Your claims</h2>
          {mine.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nothing claimed yet.</p>
          ) : (
            <ul className="divide-y">
              {mine.map((c) => (
                <ClaimRow key={c.id} c={c}>
                  {c.status !== "APPROVED" && <WithdrawClaim id={c.id} />}
                </ClaimRow>
              ))}
            </ul>
          )}
        </section>
      )}

      {owner && approved.length > 0 && (
        <section className="rounded-2xl border bg-card">
          <h2 className="border-b p-4 font-heading font-semibold">Approved recently</h2>
          <ul className="divide-y">
            {approved.map((c) => (
              <ClaimRow key={c.id} c={c} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
