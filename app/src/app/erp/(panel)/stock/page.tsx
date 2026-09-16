export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { copiesFor, setComposition, type RegisterRow } from "@/lib/stock-register";

export const metadata: Metadata = { title: "Stock register", robots: { index: false } };

const n = (v: number) => v.toLocaleString("en-IN");

export default async function StockPage() {
  const latest = await db.stockCount.findFirst({ orderBy: { asOf: "desc" }, select: { asOf: true } });
  if (!latest) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-10 text-center">
        <Layers className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">No stock count loaded yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Run scripts/seed-stock-register.ts to load the handwritten register.
        </p>
      </div>
    );
  }

  const rows = (await db.stockCount.findMany({
    where: { asOf: latest.asOf },
    orderBy: { sortOrder: "asc" },
  })) as unknown as RegisterRow[];

  const sets = rows.filter((r) => r.unit === "SET");
  const copies = rows.reduce(
    (acc, r) => {
      const c = copiesFor(r);
      return {
        inward: acc.inward + c.inward,
        outward: acc.outward + c.outward,
        inventory: acc.inventory + c.inventory,
      };
    },
    { inward: 0, outward: 0, inventory: 0 },
  );

  const asOfLabel = latest.asOf.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Stock register</h1>
          <p className="text-sm text-muted-foreground">
            As counted on {asOfLabel}, transcribed from the handwritten master register.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" asChild>
            <Link href="/erp/stock/sheet">
              <FileText className="size-4" /> One page sheet
            </Link>
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/erp/stock/report">
              <FileText className="size-4" /> Full statement
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Sets on hand", n(sets.reduce((s, r) => s + r.inventory, 0)), `${sets.length} graded rows`],
          ["Books on hand", n(copies.inventory), "sets expanded to titles"],
          ["Books received", n(copies.inward), "from the printer"],
          ["Books issued", n(copies.outward), "to schools and customers"],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-heading text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-heading font-semibold">The register, as written</h2>
          <p className="text-sm text-muted-foreground">
            Counted in sets for graded material and in copies for single titles, so it ties line by
            line to the physical register. Telugu and Hindi are held apart from the set.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-3">Item</th>
                <th className="p-3 text-right">Inward</th>
                <th className="p-3 text-right">Outward</th>
                <th className="p-3 text-right">On hand</th>
                <th className="p-3 text-right">Titles</th>
                <th className="p-3 text-right">Books on hand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = copiesFor(r);
                const lang = r.inventoryTelugu != null;
                return (
                  <tr key={r.label} className="border-b align-top last:border-0">
                    <td className="p-3">
                      <span className="font-medium">{r.label}</span>
                      {r.series && (
                        <span className="block text-xs text-muted-foreground">{r.series}</span>
                      )}
                      {lang && (
                        <span className="block text-xs text-muted-foreground">
                          Telugu {n(r.inventoryTelugu!)} · Hindi {n(r.inventoryHindi!)} on hand
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">{n(r.inward)}</td>
                    <td className="p-3 text-right">{n(r.outward)}</td>
                    <td className="p-3 text-right font-medium">{n(r.inventory)}</td>
                    <td className="p-3 text-right text-muted-foreground">
                      {r.unit === "SET" ? c.titles : "-"}
                    </td>
                    <td className="p-3 text-right font-medium">{n(c.inventory)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-heading font-semibold">What is inside each set</h2>
          <p className="text-sm text-muted-foreground">
            One set leaving the godown is this many books off the shelf. This is what an auditor
            counts against.
          </p>
        </div>
        <ul className="divide-y">
          {sets.map((r) => {
            const members = setComposition(r.label);
            if (members.length === 0) return null;
            return (
              <li key={r.label} className="p-4">
                <p className="mb-2 font-medium">
                  {r.label}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {members.length} titles × {n(r.inventory)} sets = {n(members.length * r.inventory)}{" "}
                    books
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => (
                    <Badge key={m.sku} variant="secondary" className="font-mono text-xs">
                      {m.sku}
                    </Badge>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
