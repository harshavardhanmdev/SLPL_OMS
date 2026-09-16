export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Image from "next/image";
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

// Literal hex, not theme tokens: this page is printed and must not follow the
// reader's dark mode.
const NAVY = "#1E2A5A";
const SAFFRON = "#F5A623";

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

      <article className="overflow-hidden rounded-2xl border bg-white text-[#16213e] print:rounded-none print:border-0">
        <header
          className="flex items-center gap-3 px-5 py-4"
          style={{ backgroundColor: NAVY, color: "#ffffff" }}
        >
          <Image
            src="/brand/sl-logo.png"
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-lg bg-white object-contain p-1"
          />
          <div className="min-w-0">
            <p className="font-heading text-lg font-bold leading-tight">{site.company}</p>
            <p className="text-xs" style={{ color: SAFFRON }}>
              Research · Innovation · Impact
            </p>
          </div>
          <div className="ml-auto text-right text-xs leading-snug">
            <p className="font-semibold">Statement of Stock</p>
            <p>as at {dateIN(latest.asOf)}</p>
            {gstin ? <p>GSTIN {gstin}</p> : null}
          </div>
        </header>

        <div className="px-5 py-5">
        <p className="mb-5 text-sm text-[#5a6478]">
          {n(totals.inward)} books received, {n(totals.outward)} issued,{" "}
          <b style={{ color: NAVY }}>{n(totals.inventory)} on hand</b> across {rows.length} register
          lines.
        </p>

        <section className="mb-8">
          <h3
            className="mb-1 border-b pb-1 font-heading font-bold"
            style={{ borderColor: SAFFRON, color: NAVY }}
          >
            Part 1: the register as kept
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Graded material is counted in sets, single titles in copies. Telugu and Hindi are held
            outside the set for Grades 1 to 5, because a school can take the core set without a
            language book. Inward less outward equals the balance on every line.
          </p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left" style={{ backgroundColor: "#eef1f8" }}>
                <th className="px-2 py-2">Item</th>
                <th className="py-2 pr-2">Unit</th>
                <th className="py-2 pr-2 text-right">Inward</th>
                <th className="py-2 pr-2 text-right">Outward</th>
                <th className="py-2 pr-2 text-right">Balance</th>
                <th className="py-2 pr-2 text-right">Tel</th>
                <th className="px-2 py-2 text-right">Hin</th>
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
                  <td className="px-2 py-1.5 text-right">
                    {r.inventoryHindi != null ? n(r.inventoryHindi) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="break-before-page">
          <h3
            className="mb-1 border-b pb-1 font-heading font-bold"
            style={{ borderColor: SAFFRON, color: NAVY }}
          >
            Part 2: the same stock, title by title
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Each set expanded into the titles it holds, so the balance can be checked against a
            physical count of the shelves. Every title carries its master stock register code.
          </p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left" style={{ backgroundColor: "#eef1f8" }}>
                <th className="px-2 py-2">Code</th>
                <th className="py-2 pr-2">Title</th>
                <th className="py-2 pr-2">Group</th>
                <th className="px-2 py-2 text-right">Copies on hand</th>
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
              <tr className="font-bold" style={{ backgroundColor: NAVY, color: "#ffffff" }}>
                <td className="px-2 py-2.5" colSpan={3}>
                  Total books on hand
                </td>
                <td className="px-2 py-2.5 text-right" style={{ color: SAFFRON }}>
                  {n(totals.inventory)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <p className="mt-6 text-[11px] leading-relaxed text-[#5a6478]">
          Transcribed from the handwritten master stock register and reconciled line by line:
          inward less outward equals the balance on every line. Counts are as at{" "}
          {dateIN(latest.asOf)} and are theoretical book balances, to be verified against a physical
          count.
        </p>
        </div>

        <footer
          className="px-5 py-2 text-[10px]"
          style={{ backgroundColor: "#eef1f8", color: "#5a6478" }}
        >
          {site.contact.address} · {site.contact.phone} · theslpl.in
        </footer>
      </article>
    </div>
  );
}
