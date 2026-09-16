export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PrintButton } from "@/components/store/print-button";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/catalog";
import { site } from "@/lib/site";
import { copiesFor, languageComposition, setComposition, type RegisterRow } from "@/lib/stock-register";

export const metadata: Metadata = { title: "Stock statement", robots: { index: false } };

const n = (v: number) => v.toLocaleString("en-IN");
const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

/**
 * The stock statement an auditor is handed.
 *
 * Two halves on purpose: the register exactly as written, so it ties line by
 * line to the handwritten book, and then every set expanded into the titles it
 * contains, so a physical shelf count can be checked against it. A register in
 * sets alone cannot be audited against a shelf.
 */
export default async function StockReportPage() {
  const latest = await db.stockCount.findFirst({ orderBy: { asOf: "desc" }, select: { asOf: true } });
  if (!latest) {
    return <p className="p-10 text-center text-muted-foreground">No stock count loaded yet.</p>;
  }

  const [rows, gstin] = await Promise.all([
    db.stockCount.findMany({ where: { asOf: latest.asOf }, orderBy: { sortOrder: "asc" } }) as unknown as Promise<
      RegisterRow[]
    >,
    getSetting<string>("company_gstin", ""),
  ]);

  const totals = rows.reduce(
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

  // One line per title, which is what gets counted on a shelf
  const titleLines: { sku: string; title: string; group: string; onHand: number }[] = [];
  for (const r of rows) {
    if (r.unit === "COPY") {
      titleLines.push({
        sku: r.sku ?? "-",
        title: r.label,
        group: "Single titles",
        onHand: r.inventory,
      });
      continue;
    }
    for (const m of setComposition(r.label)) {
      titleLines.push({ sku: m.sku, title: `${r.label} ${m.subject}`, group: r.label, onHand: r.inventory });
    }
    const lang = languageComposition(r.label);
    if (lang.telugu && r.inventoryTelugu != null) {
      titleLines.push({
        sku: lang.telugu.sku,
        title: `${r.label} Telugu`,
        group: r.label,
        onHand: r.inventoryTelugu,
      });
    }
    if (lang.hindi && r.inventoryHindi != null) {
      titleLines.push({
        sku: lang.hindi.sku,
        title: `${r.label} Hindi`,
        group: r.label,
        onHand: r.inventoryHindi,
      });
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/erp/stock"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to the register
        </Link>
        <PrintButton label="Print or save as PDF" />
      </div>

      <article className="rounded-2xl border bg-card p-6 print:rounded-none print:border-0 print:p-0">
        <header className="mb-6 border-b pb-4">
          <h1 className="font-heading text-xl font-bold">{site.company}</h1>
          <p className="text-sm text-muted-foreground">
            {site.contact.address}
            {gstin ? (
              <>
                <br />
                GSTIN {gstin}
              </>
            ) : null}
          </p>
          <h2 className="mt-4 font-heading text-lg font-semibold">
            Statement of stock as at {dateIN(latest.asOf)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {n(totals.inward)} books received, {n(totals.outward)} issued, {n(totals.inventory)} on
            hand across {rows.length} register lines.
          </p>
        </header>

        <section className="mb-8">
          <h3 className="mb-1 font-heading font-semibold">Part 1: the register as kept</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Graded material is counted in sets, single titles in copies. Telugu and Hindi are held
            outside the set for Grades 1 to 5, because a school can take the core set without a
            language book. Inward less outward equals the balance on every line.
          </p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pr-2">Unit</th>
                <th className="py-2 pr-2 text-right">Inward</th>
                <th className="py-2 pr-2 text-right">Outward</th>
                <th className="py-2 pr-2 text-right">Balance</th>
                <th className="py-2 pr-2 text-right">Telugu</th>
                <th className="py-2 text-right">Hindi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b last:border-0 align-top">
                  <td className="py-1.5 pr-2">
                    {r.label}
                    {r.note && <span className="block text-muted-foreground">{r.note}</span>}
                  </td>
                  <td className="py-1.5 pr-2">{r.unit === "SET" ? "Sets" : "Copies"}</td>
                  <td className="py-1.5 pr-2 text-right">{n(r.inward)}</td>
                  <td className="py-1.5 pr-2 text-right">{n(r.outward)}</td>
                  <td className="py-1.5 pr-2 text-right font-medium">{n(r.inventory)}</td>
                  <td className="py-1.5 pr-2 text-right">
                    {r.inventoryTelugu != null ? n(r.inventoryTelugu) : "-"}
                  </td>
                  <td className="py-1.5 text-right">
                    {r.inventoryHindi != null ? n(r.inventoryHindi) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="break-before-page">
          <h3 className="mb-1 font-heading font-semibold">Part 2: the same stock, title by title</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Each set expanded into the titles it holds, so the balance can be checked against a
            physical count of the shelves. Every title carries its master stock register code.
          </p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-2">Code</th>
                <th className="py-2 pr-2">Title</th>
                <th className="py-2 pr-2">Group</th>
                <th className="py-2 text-right">Copies on hand</th>
              </tr>
            </thead>
            <tbody>
              {titleLines.map((t) => (
                <tr key={`${t.group}-${t.sku}`} className="border-b last:border-0">
                  <td className="py-1.5 pr-2 font-mono">{t.sku}</td>
                  <td className="py-1.5 pr-2">{t.title}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{t.group}</td>
                  <td className="py-1.5 text-right font-medium">{n(t.onHand)}</td>
                </tr>
              ))}
              <tr className="border-t-2 font-bold">
                <td className="py-2" colSpan={3}>
                  Total books on hand
                </td>
                <td className="py-2 text-right">{n(totals.inventory)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer className="mt-10 grid gap-10 text-sm sm:grid-cols-2">
          <div>
            <div className="h-14 border-b" />
            <p className="mt-1 text-muted-foreground">Director</p>
          </div>
          <div>
            <div className="h-14 border-b" />
            <p className="mt-1 text-muted-foreground">Auditor</p>
          </div>
        </footer>
        <p className="mt-6 text-xs text-muted-foreground">
          Transcribed from the handwritten master stock register and reconciled line by line:
          inward less outward equals the balance on every line. Counts are as at{" "}
          {dateIN(latest.asOf)} and are theoretical book balances, to be verified against a physical
          count.
        </p>
      </article>
    </div>
  );
}
