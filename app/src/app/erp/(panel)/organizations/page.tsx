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
import { getStaff, roleCan } from "@/lib/staff-auth";

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
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");
  const canAdd = roleCan(staff.role, "crm.write");

  const { q, status } = await searchParams;
  const where = {
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status && status !== "all" ? { status: status as never } : {}),
  };

  const organizations = await db.organization.findMany({
    where,
    orderBy: { name: "asc" },
    take: 300,
    include: {
      owner: { select: { name: true } },
      invoices: { where: { status: { in: [...BILLED_STATUSES] } }, select: { total: true } },
      receipts: { where: { voidedAt: null }, select: { amount: true } },
      returns: { select: { total: true, refunded: true } },
      _count: { select: { visits: true } },
    },
  });

  const rows = organizations.map((o) => {
    const billed = o.invoices.reduce((s, i) => s + i.total, 0);
    const received = o.receipts.reduce((s, r) => s + r.amount, 0);
    const returned = o.returns.reduce((s, r) => s + r.total - r.refunded, 0);
    return { ...o, billed, outstanding: billed - received - returned };
  });

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Organisations</h1>
          <p className="text-sm text-muted-foreground">
            One record per school. Everything hangs off it: visits, quotations, bills, payments,
            samples and gifts.
          </p>
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
        <Button type="submit" variant="outline" className="h-11">
          Search
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Organisations", String(rows.length), q || status ? "matching" : "on the books"],
          ["Active", String(rows.filter((r) => r.status === "ACTIVE").length), "buying from us"],
          ["Billed", formatINR(rows.reduce((s, r) => s + r.billed, 0)), "across these rows"],
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
        <ul className="space-y-3">
          {rows.map((o) => (
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
                    {o._count.visits} {o._count.visits === 1 ? "visit" : "visits"}
                    {o.owner ? ` · ${o.owner.name}` : ""}
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
      )}
    </div>
  );
}
