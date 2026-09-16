export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PrintButton } from "@/components/store/print-button";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/catalog";
import { site } from "@/lib/site";
import { copiesFor, setComposition, type RegisterRow } from "@/lib/stock-register";

export const metadata: Metadata = { title: "Stock sheet", robots: { index: false } };

const n = (v: number | null | undefined) => (v == null ? "-" : v.toLocaleString("en-IN"));
const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

const NAVY = "#1E2A5A";
const SAFFRON = "#F5A623";

/**
 * The one page version, laid out like the handwritten master sheet: every row
 * visible at once, inward, outward and balance side by side, with Telugu and
 * Hindi in their own columns exactly as the register keeps them.
 *
 * Colours are written as literal hex rather than theme tokens, because this
 * page is printed and must not follow the reader's dark mode.
 */
export default async function StockSheetPage() {
  const latest = await db.stockCount.findFirst({ orderBy: { asOf: "desc" }, select: { asOf: true } });
  if (!latest) {
    return <p className="p-10 text-center text-muted-foreground">No stock count loaded yet.</p>;
  }

  const [rows, gstin] = await Promise.all([
    db.stockCount.findMany({
      where: { asOf: latest.asOf },
      orderBy: { sortOrder: "asc" },
    }) as unknown as Promise<RegisterRow[]>,
    getSetting<string>("company_gstin", ""),
  ]);

  const totals = rows.reduce(
    (acc, r) => {
      const c = copiesFor(r);
      return {
        sets: acc.sets + (r.unit === "SET" ? r.inventory : 0),
        inward: acc.inward + c.inward,
        outward: acc.outward + c.outward,
        inventory: acc.inventory + c.inventory,
      };
    },
    { sets: 0, inward: 0, outward: 0, inventory: 0 },
  );

  const th = "px-2.5 py-2 text-right font-semibold";
  const td = "px-2.5 py-1.5 text-right tabular-nums";

  return (
    <div className="mx-auto max-w-6xl">
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
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
            <p className="font-semibold">Master Stock Register</p>
            <p>as at {dateIN(latest.asOf)}</p>
            {gstin ? <p>GSTIN {gstin}</p> : null}
          </div>
        </header>

        <div className="px-5 py-4">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr style={{ backgroundColor: "#eef1f8" }}>
                <th className="px-2.5 py-2 text-left font-semibold">Item</th>
                <th className="px-2.5 py-2 text-left font-semibold">Unit</th>
                <th className={th}>Inward</th>
                <th className={th} style={{ color: NAVY }}>
                  Tel
                </th>
                <th className={th} style={{ color: NAVY }}>
                  Hin
                </th>
                <th className={th}>Outward</th>
                <th className={th} style={{ color: NAVY }}>
                  Tel
                </th>
                <th className={th} style={{ color: NAVY }}>
                  Hin
                </th>
                <th className={th}>Balance</th>
                <th className={th} style={{ color: NAVY }}>
                  Tel
                </th>
                <th className={th} style={{ color: NAVY }}>
                  Hin
                </th>
                <th className={th}>Books</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const c = copiesFor(r);
                return (
                  <tr
                    key={r.label}
                    style={{ backgroundColor: i % 2 ? "#fafbfe" : "#ffffff" }}
                    className="border-b border-[#e3e8f2]"
                  >
                    <td className="whitespace-nowrap px-2.5 py-1.5 font-medium">{r.label}</td>
                    <td className="px-2.5 py-1.5 text-[#5a6478]">{r.unit === "SET" ? "Sets" : "Copies"}</td>
                    <td className={td}>{n(r.inward)}</td>
                    <td className={td}>{n(r.inwardTelugu)}</td>
                    <td className={td}>{n(r.inwardHindi)}</td>
                    <td className={td}>{n(r.outward)}</td>
                    <td className={td}>{n(r.outwardTelugu)}</td>
                    <td className={td}>{n(r.outwardHindi)}</td>
                    <td className={td} style={{ fontWeight: 700 }}>
                      {n(r.inventory)}
                    </td>
                    <td className={td}>{n(r.inventoryTelugu)}</td>
                    <td className={td}>{n(r.inventoryHindi)}</td>
                    <td className={td} style={{ fontWeight: 700, color: NAVY }}>
                      {n(c.inventory)}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ backgroundColor: NAVY, color: "#ffffff" }}>
                <td className="px-2.5 py-2.5 font-bold" colSpan={8}>
                  Total
                </td>
                <td className={`${td} font-bold`}>{n(totals.sets)} sets</td>
                <td className={td} colSpan={2} />
                <td className={`${td} font-bold`} style={{ color: SAFFRON }}>
                  {n(totals.inventory)}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mt-4 text-[11px] leading-relaxed text-[#5a6478]">
            Graded material is counted in sets, single titles in copies. Telugu and Hindi are held
            outside the set for Grades 1 to 5, because a school can take the core set without a
            language book. The Books column expands each set into the titles it holds.{" "}
            <b>Inward less outward equals the balance on every line.</b> Balances are theoretical and
            are to be verified against a physical count. A title by title breakdown is available on
            request.
          </p>

          <section className="mt-6">
            <h2
              className="mb-2 border-b pb-1 font-heading text-sm font-bold"
              style={{ borderColor: SAFFRON, color: NAVY }}
            >
              What one set contains
            </h2>
            <ul className="grid gap-x-8 gap-y-1 text-[11px] sm:grid-cols-2">
              {rows
                .filter((r) => r.unit === "SET")
                .map((r) => {
                  const members = setComposition(r.label);
                  if (members.length === 0) return null;
                  return (
                    <li key={r.label} className="leading-snug">
                      <b style={{ color: NAVY }}>{r.label}</b>{" "}
                      <span className="text-[#5a6478]">
                        {members.length} titles: {members.map((m) => m.sku).join(", ")}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </section>
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
