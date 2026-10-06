export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";

import { TargetEditor } from "@/components/erp/target-editor";
import { db } from "@/lib/db";
import { BILLED_STATUSES } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { financialYearWindow } from "@/lib/sales-summary";
import { getStaff, roleCan } from "@/lib/staff-auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Targets", robots: { index: false } };

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Figures = { revenue: number; visits: number; organizations: number };
type Row = {
  key: string;
  label: string;
  sub: string;
  scope: "COMPANY" | "PERSON";
  ownerId: string | null;
  target: Figures;
  done: Figures;
};

async function achieved(start: Date, end: Date, personId: string | null): Promise<Figures> {
  const [billed, visits, organizations] = await Promise.all([
    db.invoice.aggregate({
      where: {
        status: { in: [...BILLED_STATUSES] },
        invoiceDate: { gte: start, lt: end },
        ...(personId ? { createdById: personId } : {}),
      },
      _sum: { total: true },
    }),
    db.visit.count({
      where: { visitedOn: { gte: start, lt: end }, ...(personId ? { byId: personId } : {}) },
    }),
    db.organization.count({
      where: { createdAt: { gte: start, lt: end }, ...(personId ? { ownerId: personId } : {}) },
    }),
  ]);
  return { revenue: billed._sum.total ?? 0, visits, organizations };
}

function Meter({ done, target, money }: { done: number; target: number; money?: boolean }) {
  const pct = target > 0 ? Math.min(1, done / target) : 0;
  const show = (n: number) => (money ? formatINR(n) : String(n));
  return (
    <div className="min-w-0">
      <p className="text-sm tabular-nums">
        <span className="font-semibold">{show(done)}</span>
        <span className="text-muted-foreground"> / {target > 0 ? show(target) : "not set"}</span>
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full origin-left rounded-full motion-safe:animate-[erp-grow_800ms_ease-out]",
            pct >= 1 ? "bg-green-600" : "bg-saffron",
          )}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Who is aiming for what, and how far they have got.
 *
 * Achieved is read off approved invoices, logged visits and schools added,
 * never typed, so nobody can talk a figure up. A salesperson sees their own
 * line and the company's; a manager sees their team; an owner sees everyone
 * and sets the figures.
 */
export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string }>;
}) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");
  const canEdit = roleCan(staff.role, "staff.manage");

  const { month, view } = await searchParams;
  const now = new Date();
  const [yy, mm] = (month ?? "").split("-").map(Number);
  const monthStart =
    yy && mm ? new Date(yy, mm - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  const year = view === "year";
  const fy = financialYearWindow(monthStart);
  const start = year ? fy.start : monthStart;
  const end = year ? fy.end : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const period = year ? "YEAR" : "MONTH";
  const title = year
    ? fy.label
    : monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // Who this person may see: everyone, their team, or just themselves
  const sales = await db.adminUser.findMany({
    where: { isActive: true, role: { in: ["SALES", "SALES_MANAGER"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, reportsToId: true },
  });
  const visible = roleCan(staff.role, "staff.manage")
    ? sales
    : roleCan(staff.role, "crm.manage")
      ? sales.filter((p) => p.id === staff.id || p.reportsToId === staff.id)
      : sales.filter((p) => p.id === staff.id);

  const targets = await db.salesTarget.findMany({ where: { period, periodStart: start } });
  const targetOf = (scope: "COMPANY" | "PERSON", ownerId: string | null): Figures => {
    const t = targets.find((x) => x.scope === scope && x.ownerId === ownerId);
    return {
      revenue: t?.revenueTarget ?? 0,
      visits: t?.visitTarget ?? 0,
      organizations: t?.organizationTarget ?? 0,
    };
  };

  const rows: Row[] = [
    {
      key: "company",
      label: "Company",
      sub: "Everyone's invoices, visits and new schools",
      scope: "COMPANY",
      ownerId: null,
      target: targetOf("COMPANY", null),
      done: await achieved(start, end, null),
    },
    ...(await Promise.all(
      visible.map(async (p) => ({
        key: p.id,
        label: p.name,
        sub: p.role === "SALES_MANAGER" ? "Sales manager" : "Sales executive",
        scope: "PERSON" as const,
        ownerId: p.id,
        target: targetOf("PERSON", p.id),
        done: await achieved(start, end, p.id),
      })),
    )),
  ];

  const shift = (by: number) => {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth() + (year ? by * 12 : by), 1);
    const params = new URLSearchParams({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` });
    if (year) params.set("view", "year");
    return `/erp/targets?${params.toString()}`;
  };
  const monthParam = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Targets</h1>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "Set what each person is aiming for. Achieved figures come from approved invoices and logged visits."
              : "What you are aiming for, and how far you have got."}
          </p>
        </div>
        <div className="flex rounded-lg border p-0.5 text-sm">
          {[
            ["Month", `/erp/targets?month=${monthParam}`, !year],
            ["Financial year", `/erp/targets?month=${monthParam}&view=year`, year],
          ].map(([text, href, active]) => (
            <Link
              key={String(text)}
              href={String(href)}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                active ? "bg-navy text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {text}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border bg-card px-2 py-2">
        <Link href={shift(-1)} className="rounded-lg p-2 transition hover:bg-muted" aria-label="Earlier">
          <ChevronLeft className="size-5" />
        </Link>
        <p className="flex items-center gap-2 font-heading font-semibold">
          <Target className="size-4 text-saffron-deep" /> {title}
        </p>
        <Link href={shift(1)} className="rounded-lg p-2 transition hover:bg-muted" aria-label="Later">
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <ul className="erp-stagger space-y-3">
        {rows.map((r) => (
          <li
            key={r.key}
            className={cn(
              "rounded-2xl border bg-card p-4",
              r.scope === "COMPANY" && "border-navy/30 bg-navy/[0.03]",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-heading font-semibold">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.sub}</p>
              </div>
              {canEdit && (
                <TargetEditor
                  scope={r.scope}
                  ownerId={r.ownerId}
                  period={period}
                  periodStart={ymd(start)}
                  revenue={r.target.revenue}
                  visits={r.target.visits}
                  organizations={r.target.organizations}
                  label={`${r.label}, ${title}`}
                />
              )}
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Revenue
                </p>
                <Meter done={r.done.revenue} target={r.target.revenue} money />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Visits
                </p>
                <Meter done={r.done.visits} target={r.target.visits} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  New schools
                </p>
                <Meter done={r.done.organizations} target={r.target.organizations} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No sales staff yet. Add them from Staff with the Sales or Sales manager role.
        </p>
      )}
    </div>
  );
}
