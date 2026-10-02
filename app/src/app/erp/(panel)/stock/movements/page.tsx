export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, FileText, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MovementForm, type LineOption } from "@/components/erp/movement-form";
import { VoidMovement } from "@/components/erp/void-movement";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";
import { kindLabel } from "@/lib/stock-moves";

export const metadata: Metadata = { title: "Stock movements", robots: { index: false } };

const n = (v: number) => Math.abs(v).toLocaleString("en-IN");
const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function MovementsPage() {
  const staff = await getStaff();
  const canWrite = staff ? roleCan(staff.role, "finance.write") : false;

  const latest = await db.stockCount.findFirst({ orderBy: { asOf: "desc" }, select: { asOf: true } });
  const [counted, movements] = await Promise.all([
    latest
      ? db.stockCount.findMany({
          where: { asOf: latest.asOf },
          orderBy: { sortOrder: "asc" },
          select: { label: true, series: true, unit: true },
        })
      : Promise.resolve([]),
    db.stockMovement.findMany({ orderBy: [{ movedAt: "desc" }, { createdAt: "desc" }], take: 200 }),
  ]);

  // Every counted line, plus the term 2 lines that only exist as movements
  const options = new Map<string, LineOption>();
  for (const row of counted) {
    options.set(row.label, { label: row.label, series: row.series, unit: row.unit });
  }
  for (const grade of [1, 2, 3, 4, 5]) {
    const label = `Grade ${grade} Term 2`;
    if (!options.has(label)) {
      options.set(label, { label, series: "Little Leaps", unit: "SET" });
    }
  }
  for (const m of movements) {
    if (!options.has(m.label)) {
      options.set(m.label, { label: m.label, series: m.series, unit: m.unit });
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/erp/stock"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Back to the register
          </Link>
          <h1 className="font-heading text-2xl font-bold">Stock movements</h1>
          <p className="text-sm text-muted-foreground">
            Everything that has come in or gone out since the register was counted. The monthly
            statement is built from these, so the copy for the bank stops being handwork.
          </p>
        </div>
        <Button variant="outline" className="gap-2" asChild>
          <Link href="/erp/stock/statement">
            <FileText className="size-4" /> Monthly statement
          </Link>
        </Button>
      </div>

      {canWrite ? (
        <MovementForm lines={[...options.values()]} />
      ) : (
        <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          You can read the register and print the statement. Recording a movement needs an accounts
          or owner login.
        </p>
      )}

      {movements.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Truck className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing recorded yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The counted register stands as it was. Record the first receipt or return above.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-3">Date</th>
                  <th className="p-3">Line</th>
                  <th className="p-3">What</th>
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3">Party</th>
                  <th className="p-3">Reference</th>
                  {canWrite && <th className="p-3" />}
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap p-3">{dateIN(m.movedAt)}</td>
                    <td className="p-3">
                      <span className="font-medium">{m.label}</span>
                      {m.series && (
                        <span className="block text-xs text-muted-foreground">{m.series}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {kindLabel(m.kind)}
                      {m.voidedAt && (
                        <Badge className="ml-2 bg-muted text-muted-foreground">Void</Badge>
                      )}
                      {m.note && <span className="block text-xs text-muted-foreground">{m.note}</span>}
                      {m.voidReason && (
                        <span className="block text-xs text-muted-foreground">
                          Voided: {m.voidReason}
                        </span>
                      )}
                    </td>
                    <td
                      className={`whitespace-nowrap p-3 text-right font-medium tabular-nums ${
                        m.voidedAt
                          ? "text-muted-foreground line-through"
                          : m.quantity < 0
                            ? "text-destructive"
                            : "text-green-700 dark:text-green-400"
                      }`}
                    >
                      {m.quantity < 0 ? "-" : "+"}
                      {n(m.quantity)} {m.unit === "SET" ? "sets" : "copies"}
                      {(m.quantityTelugu || m.quantityHindi) && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          Tel {n(m.quantityTelugu ?? 0)} · Hin {n(m.quantityHindi ?? 0)}
                        </span>
                      )}
                    </td>
                    <td className="p-3">{m.party ?? "-"}</td>
                    <td className="p-3">
                      <span className="font-mono text-xs">{m.ref}</span>
                      {m.document && (
                        <span className="block text-xs text-muted-foreground">{m.document}</span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        {!m.voidedAt && <VoidMovement id={m.id} reference={m.ref} />}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
