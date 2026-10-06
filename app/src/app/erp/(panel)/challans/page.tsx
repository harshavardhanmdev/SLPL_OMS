export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Plus, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Delivery challans", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function ChallansPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");
  const canWrite = roleCan(staff.role, "challan.write");

  const challans = await db.deliveryChallan.findMany({
    orderBy: [{ dispatchedOn: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      invoice: { select: { number: true } },
      items: { select: { quantity: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Delivery challans</h1>
          <p className="text-sm text-muted-foreground">
            The paper that travels with the books. Not an e-way bill.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/erp/export/challans">
              <Download className="size-4" /> Download
            </Link>
          </Button>
          {canWrite && (
            <Button className="gap-2" asChild>
              <Link href="/erp/challans/new">
                <Plus className="size-4" /> Raise a challan
              </Link>
            </Button>
          )}
        </div>
      </div>

      {challans.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Truck className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No challans yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canWrite
              ? "Raise one from an invoice, or start a blank one."
              : "They appear here once a manager raises one."}
          </p>
          {canWrite && (
            <Button className="mt-4 gap-2" asChild>
              <Link href="/erp/challans/new">
                <Plus className="size-4" /> Raise a challan
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {challans.map((c) => (
            <li key={c.id}>
              <Link
                href={`/erp/challans/${c.id}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 transition hover:border-saffron"
              >
                <div className="min-w-0">
                  <p className="font-heading font-semibold">{c.toName}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{c.number}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateIN(c.dispatchedOn)}
                    {c.invoice ? ` · against ${c.invoice.number}` : ""}
                    {c.transporter ? ` · ${c.transporter}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-heading font-bold">
                    {c.items.reduce((s, i) => s + i.quantity, 0)} items
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.vehicleNumber ?? "Vehicle not filled in yet"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
