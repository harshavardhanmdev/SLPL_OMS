export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PrintButton } from "@/components/store/print-button";
import { getSetting } from "@/lib/catalog";
import { site } from "@/lib/site";
import { monthlyStatement } from "@/lib/stock-ledger";
import { monthWindow } from "@/lib/stock-moves";

export const metadata: Metadata = { title: "Monthly stock statement", robots: { index: false } };

const NAVY = "#1E2A5A";
const SAFFRON = "#F5A623";

const n = (v: number) => v.toLocaleString("en-IN");
const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

/**
 * The statement the bank gets each month: opening, what moved, closing.
 *
 * Built from the counted register plus the movement ledger, so nobody retypes
 * anything and this month's closing is next month's opening by construction.
 *
 * Colours are literal hex rather than theme tokens, because this page is
 * printed and must not follow the reader's dark mode.
 */
export default async function StockStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const [statement, gstin] = await Promise.all([
    monthlyStatement(month),
    getSetting<string>("company_gstin", ""),
  ]);
  const { window, lines, totals, countedOn } = statement;

  // Neighbouring months, so the owner can step back without typing a date
  const prev = monthWindow(
    `${new Date(window.start.getFullYear(), window.start.getMonth() - 1, 1).getFullYear()}-${String(
      new Date(window.start.getFullYear(), window.start.getMonth() - 1, 1).getMonth() + 1,
    ).padStart(2, "0")}`,
  );
  const nextStart = new Date(window.start.getFullYear(), window.start.getMonth() + 1, 1);
  const next = monthWindow(
    `${nextStart.getFullYear()}-${String(nextStart.getMonth() + 1).padStart(2, "0")}`,
  );
  const moved = lines.filter(
    (l) => l.received || l.issued || l.returnedIn || l.returnedOut || l.adjusted,
  );

  const th = "px-2 py-2 text-right font-semibold";
  const td = "px-2 py-1.5 text-right tabular-nums";

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
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/erp/stock/statement?month=${prev.key}`}
            className="rounded-md border px-3 py-1.5 text-sm transition hover:bg-accent"
          >
            {prev.label}
          </Link>
          <Link
            href={`/erp/stock/statement?month=${next.key}`}
            className="rounded-md border px-3 py-1.5 text-sm transition hover:bg-accent"
          >
            {next.label}
          </Link>
          <PrintButton label="Print the statement" />
        </div>
      </div>

      <div className="bg-white p-6 text-black" style={{ color: NAVY }}>
        <header
          className="mb-4 flex items-start gap-3 border-b-2 pb-3"
          style={{ borderColor: SAFFRON }}
        >
          <Image
            src="/brand/sl-logo.png"
            alt=""
            width={48}
            height={48}
            className="size-12 object-contain"
          />
          <div className="flex-1">
            <p className="font-heading text-lg font-bold">{site.company}</p>
            <p className="text-sm">{site.contact.address}</p>
            {gstin && <p className="text-xs">GSTIN {gstin}</p>}
          </div>
          <div className="text-right">
            <p className="font-heading text-base font-bold">Statement of Stock</p>
            <p className="text-sm">{window.label}</p>
            <p className="text-xs">
              {dateIN(window.start)} to {dateIN(new Date(window.end.getTime() - 86400000))}
            </p>
          </div>
        </header>

        {/* The first four are sets and copies added together, which is what the
            register itself does; books on hand is the unambiguous figure. */}
        <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          {[
            ["Opening", n(totals.opening), "sets and copies"],
            ["Received", n(totals.received), "sets and copies"],
            ["Issued", n(totals.issued), "sets and copies"],
            ["Closing", n(totals.closing), "sets and copies"],
            [
              "Books on hand",
              n(totals.closingCopies),
              `sets expanded, plus ${n(totals.closingTelugu + totals.closingHindi)} language books`,
            ],
          ].map(([head, value, hint]) => (
            <div key={head} className="rounded border p-2" style={{ borderColor: "#e3e8f2" }}>
              <p className="text-xs" style={{ color: "#5a6478" }}>
                {head}
              </p>
              <p className="font-heading text-base font-bold">{value}</p>
              <p className="text-[10px]" style={{ color: "#5a6478" }}>
                {hint}
              </p>
            </div>
          ))}
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr style={{ backgroundColor: NAVY, color: "#ffffff" }}>
              <th className="px-2 py-2 text-left font-semibold">Item</th>
              <th className={th}>Opening</th>
              <th className={th}>Received</th>
              <th className={th}>Returned in</th>
              <th className={th}>Issued</th>
              <th className={th}>Returned out</th>
              <th className={th}>Adjusted</th>
              <th className={th}>Closing</th>
              <th className={th}>Titles</th>
              <th className={th}>Books on hand</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr
                key={l.label}
                style={{ backgroundColor: i % 2 ? "#f7f9fc" : "#ffffff" }}
                className="border-b"
              >
                <td className="px-2 py-1.5">
                  <span className="font-medium">{l.label}</span>
                  {l.series && (
                    <span className="block text-[10px]" style={{ color: "#5a6478" }}>
                      {l.series}
                    </span>
                  )}
                  {(l.closingTelugu > 0 || l.closingHindi > 0) && (
                    <span className="block text-[10px]" style={{ color: "#5a6478" }}>
                      Telugu {n(l.closingTelugu)} · Hindi {n(l.closingHindi)}, held outside the set
                    </span>
                  )}
                </td>
                <td className={td}>{n(l.opening)}</td>
                <td className={td}>{l.received ? n(l.received) : "-"}</td>
                <td className={td}>{l.returnedIn ? n(l.returnedIn) : "-"}</td>
                <td className={td}>{l.issued ? n(l.issued) : "-"}</td>
                <td className={td}>{l.returnedOut ? n(l.returnedOut) : "-"}</td>
                <td className={td}>{l.adjusted ? n(l.adjusted) : "-"}</td>
                <td className={`${td} font-bold`}>{n(l.closing)}</td>
                <td className={td} style={{ color: "#5a6478" }}>
                  {l.unit === "SET" ? l.titlesPerSet : "-"}
                </td>
                <td className={`${td} font-medium`}>{n(l.closingCopies)}</td>
              </tr>
            ))}
            <tr style={{ backgroundColor: NAVY, color: "#ffffff" }}>
              <td className="px-2 py-2 font-bold">Total</td>
              <td className={`${td} font-bold`}>{n(totals.opening)}</td>
              <td className={`${td} font-bold`}>{n(totals.received)}</td>
              <td className={`${td} font-bold`}>{n(totals.returnedIn)}</td>
              <td className={`${td} font-bold`}>{n(totals.issued)}</td>
              <td className={`${td} font-bold`}>{n(totals.returnedOut)}</td>
              <td className={`${td} font-bold`}>{n(totals.adjusted)}</td>
              <td className={`${td} font-bold`}>{n(totals.closing)}</td>
              <td className={td} />
              <td className={`${td} font-bold`}>{n(totals.closingCopies)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 text-[11px] leading-relaxed" style={{ color: "#5a6478" }}>
          <p>
            Graded material is counted in sets and single titles in copies. A set is expanded to
            books in the last column, which is what a physical count on the shelf gives. Telugu and
            Hindi are held outside the Grade 1 to 5 sets, and a Term 2 set is four titles rather
            than six because Computer, General Knowledge, Telugu and Hindi are printed once for the
            year.
          </p>
          {countedOn && (
            <p className="mt-1">
              Opening balances carry forward from the register physically counted on{" "}
              {dateIN(countedOn)}, adjusted for every movement recorded since.
            </p>
          )}
          <p className="mt-1">
            {moved.length === 0
              ? "No stock moved in this period."
              : `${moved.length} of ${lines.length} lines moved in this period.`}{" "}
            Movements are never edited or deleted; a correction is recorded as its own entry.
          </p>
          <p className="mt-2">
            Generated {dateIN(new Date())} from the stock ledger of {site.company}.
          </p>
        </div>
      </div>
    </div>
  );
}
