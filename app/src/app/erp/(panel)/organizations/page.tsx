export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Download, Plus, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { BILLED_STATUSES } from "@/lib/ledger";
import { ownsSchool, salesTeam, SCHOOLS_ONLY } from "@/lib/money-scope";
import { getStaff, roleCan } from "@/lib/staff-auth";
import { monthKey, monthLabel, monthRange } from "@/lib/utils";

export const metadata: Metadata = { title: "Organisations", robots: { index: false } };

const tone: Record<string, string> = {
  LEAD: "bg-muted text-muted-foreground border-border",
  ACTIVE: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
  DORMANT: "bg-saffron/15 text-saffron-deep border-saffron/40",
  LOST: "bg-muted text-muted-foreground border-border",
};

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; month?: string; kind?: string }>;
}) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");
  const canAdd = roleCan(staff.role, "crm.write");
  const team = await salesTeam(staff);

  const { q, status, month: rawMonth, kind } = await searchParams;
  // People billed directly are listed apart, and only for those who see every bill
  const people = team === null && kind === "people";
  const kindWhere = people ? { kind: "INDIVIDUAL" as const } : SCHOOLS_ONLY;
  const range = monthRange(rawMonth);
  const month = range ? rawMonth : undefined;
  const where = {
    ...kindWhere,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status && status !== "all" ? { status: status as never } : {}),
    ...(range ? { createdAt: range } : {}),
  };

  // How many schools were added each month, for the filter
  const added = new Map<string, number>();
  for (const o of await db.organization.findMany({ where: kindWhere, select: { createdAt: true } })) {
    const key = monthKey(o.createdAt);
    added.set(key, (added.get(key) ?? 0) + 1);
  }
  const months = [...added.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const peopleCount = team === null && !people ? await db.organization.count({ where: { kind: "INDIVIDUAL" } }) : 0;

  const organizations = await db.organization.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    include: {
      owner: { select: { name: true } },
      invoices: { where: { status: { in: [...BILLED_STATUSES] } }, select: { total: true } },
      receipts: { where: { voidedAt: null }, select: { amount: true } },
      returns: { select: { total: true, refunded: true } },
      _count: { select: { visits: true } },
    },
  });

  // A salesperson sees what their own schools owe, not every school's
  const rows = organizations.map((o) => {
    if (!ownsSchool(team, o.ownerId)) return { ...o, billed: 0, outstanding: 0 };
    const billed = o.invoices.reduce((s, i) => s + i.total, 0);
    const received = o.receipts.reduce((s, r) => s + r.amount, 0);
    const returned = o.returns.reduce((s, r) => s + r.total - r.refunded, 0);
    return { ...o, billed, outstanding: billed - received - returned };
  });

  // Divided by the month each school was added, newest month first
  const groups: { key: string; rows: typeof rows }[] = [];
  for (const o of rows) {
    const key = monthKey(o.createdAt);
    const group = groups.find((g) => g.key === key);
    if (group) group.rows.push(o);
    else groups.push({ key, rows: [o] });
  }
  for (const g of groups) g.rows.sort((a, b) => a.name.localeCompare(b.name));

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (month) params.set("month", month);
  if (people) params.set("kind", "people");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">{people ? "People billed directly" : "Organisations"}</h1>
          <p className="text-sm text-muted-foreground">
            {people
              ? "Customers billed as individuals, not schools. Sales do not see them."
              : "One record per school. Everything hangs off it: visits, quotations, bills, payments, samples and gifts."}
          </p>
          {(people || peopleCount > 0) && (
            <Link
              href={people ? "/erp/organizations" : "/erp/organizations?kind=people"}
              className="text-sm font-medium underline"
            >
              {people ? "Back to schools" : `People billed directly (${peopleCount})`}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href={`/erp/export/organizations?${params.toString()}`}>
              <Download className="size-4" /> Excel
            </Link>
          </Button>
          {canAdd && (
            <Button variant="outline" className="gap-2" asChild>
              <Link href="/erp/organizations/import">
                <Upload className="size-4" /> Import from Excel
              </Link>
            </Button>
          )}
          {canAdd && (
            <Button className="gap-2" asChild>
              <Link href="/erp/organizations/new">
                <Plus className="size-4" /> Add one
              </Link>
            </Button>
          )}
        </div>
      </div>

      <form className="flex flex-wrap gap-2" action="/erp/organizations">
        {people && <input type="hidden" name="kind" value="people" />}
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name"
          className="h-11 max-w-xs"
        />
        <select
          name="status"
          defaultValue={status ?? "all"}
          className="flex h-11 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="all">Every status</option>
          <option value="LEAD">Leads</option>
          <option value="ACTIVE">Active</option>
          <option value="DORMANT">Dormant</option>
          <option value="LOST">Lost</option>
        </select>
        <select
          name="month"
          aria-label="Month added"
          defaultValue={month ?? ""}
          className="flex h-11 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Every month</option>
          {months.map(([key, count]) => (
            <option key={key} value={key}>
              {monthLabel(key)} ({count})
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" className="h-11">
          Search
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [
            people ? "People" : "Organisations",
            String(rows.length),
            month ? `added in ${monthLabel(month)}` : q || status ? "matching" : "on the books",
          ],
          ["Active", String(rows.filter((r) => r.status === "ACTIVE").length), "buying from us"],
          [
            "Billed",
            formatINR(rows.reduce((s, r) => s + r.billed, 0)),
            team ? "your schools" : "across these rows",
          ],
          [
            "Outstanding",
            formatINR(rows.reduce((s, r) => s + Math.max(0, r.outstanding), 0)),
            "still to collect",
          ],
        ].map(([head, value, hint]) => (
          <div key={head} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{head}</p>
            <p className="font-heading text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing here yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canAdd ? "Add the first school." : "Sales add schools here."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} aria-label={monthLabel(g.key)} className="space-y-3">
              <h2 className="flex items-baseline justify-between gap-2 border-b pb-1 font-heading font-semibold">
                {monthLabel(g.key)}
                <span className="text-sm font-normal text-muted-foreground">
                  {g.rows.length} {g.rows.length === 1 ? "school" : "schools"} added
                </span>
              </h2>
              <ul className="space-y-3">
                {g.rows.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/erp/organizations/${o.id}`}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 transition hover:border-saffron"
                    >
                      <div className="min-w-0">
                        <p className="font-heading font-semibold">
                          {o.name}
                          <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                            {o.code}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {[o.contactPerson, o.phone, o.city].filter(Boolean).join(" · ") || "No contact yet"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            `${o._count.visits} ${o._count.visits === 1 ? "visit" : "visits"}`,
                            o.board,
                            o.strength ? `${o.strength.toLocaleString("en-IN")} students` : null,
                            o.owner?.name,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={tone[o.status]}>{o.status.toLowerCase()}</Badge>
                        {o.billed > 0 && (
                          <p className="mt-1 text-sm">
                            {formatINR(o.billed)} billed
                            {o.outstanding > 0 && (
                              <span className="block text-xs text-destructive">
                                {formatINR(o.outstanding)} outstanding
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
