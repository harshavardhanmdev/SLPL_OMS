export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PrintButton } from "@/components/store/print-button";
import { db } from "@/lib/db";
import { categoryLabel, paidFromLabel } from "@/lib/expense-constants";
import { applyDayOfWeek, buildWhere, type ExpenseQuery } from "@/lib/expense-query";
import { formatINR } from "@/lib/money";
import { getSetting } from "@/lib/catalog";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Expense statement", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * The statement an auditor is handed. Printed from the browser rather than
 * generated as a PDF, which is the same path the kit receipts use: Ctrl+P,
 * then Save as PDF.
 */
export default async function ExpenseReportPage({
  searchParams,
}: {
  searchParams: Promise<ExpenseQuery>;
}) {
  const query = await searchParams;
  const { where, window, filters } = buildWhere(query);

  const [rows, gstin, phone, email] = await Promise.all([
    db.expense.findMany({ where, orderBy: [{ spentAt: "asc" }, { voucherNo: "asc" }] }),
    getSetting<string>("company_gstin", ""),
    getSetting<string>("contact_phone", site.contact.phone),
    getSetting<string>("contact_email", site.contact.email),
  ]);
  const expenses = applyDayOfWeek(rows, filters.days);

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const gstTotal = expenses.reduce((s, e) => s + (e.gstAmount ?? 0), 0);
  const voided = expenses.filter((e) => e.amount === 0).length;

  // Summed from the filtered rows, so the statement always agrees with itself
  const byCategory = [...expenses
    .reduce(
      (m, e) => m.set(e.category, { count: (m.get(e.category)?.count ?? 0) + 1, sum: (m.get(e.category)?.sum ?? 0) + e.amount }),
      new Map<string, { count: number; sum: number }>(),
    )
    .entries()]
    .sort((a, b) => b[1].sum - a[1].sum);

  // A statement that was filtered must say so, or it reads as the full period
  const narrowed = [
    filters.text ? `matching "${filters.text}"` : "",
    filters.categories.length > 0 ? `${filters.categories.length} head(s)` : "",
    filters.modes.length > 0 ? `${filters.modes.length} payment mode(s)` : "",
    filters.days.length > 0 ? `${filters.days.length} day(s) of the week` : "",
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/erp/expenses"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to the log
        </Link>
        <PrintButton label="Print or save as PDF" />
      </div>

      <article className="rounded-2xl border bg-card p-6 print:rounded-none print:border-0 print:p-0">
        <header className="mb-6 border-b pb-4">
          <h1 className="font-heading text-xl font-bold">{site.company}</h1>
          <p className="text-sm text-muted-foreground">
            {site.contact.address}
            <br />
            {phone} · {email}
            {gstin ? (
              <>
                <br />
                GSTIN {gstin}
              </>
            ) : null}
          </p>
          <h2 className="mt-4 font-heading text-lg font-semibold">
            Statement of expenses, {window.label}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dateIN(window.from)} to {dateIN(window.to)} · {expenses.length} entries
            {voided > 0 ? `, of which ${voided} voided` : ""}
          </p>
          {narrowed.length > 0 && (
            <p className="mt-1 text-sm font-medium">
              Filtered statement, not the full period: {narrowed.join(", ")}.
            </p>
          )}
        </header>

        <section className="mb-6">
          <h3 className="mb-2 font-heading font-semibold">Summary by head</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Head</th>
                <th className="py-2 text-right">Entries</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map(([category, agg]) => (
                <tr key={category} className="border-b last:border-0">
                  <td className="py-1.5">{categoryLabel(category)}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{agg.count}</td>
                  <td className="py-1.5 text-right">{formatINR(agg.sum)}</td>
                </tr>
              ))}
              <tr className="border-t-2 font-bold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{expenses.length}</td>
                <td className="py-2 text-right">{formatINR(total)}</td>
              </tr>
              {gstTotal > 0 && (
                <tr className="text-muted-foreground">
                  <td className="py-1.5" colSpan={2}>
                    Of which GST shown on bills
                  </td>
                  <td className="py-1.5 text-right">{formatINR(gstTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="mb-2 font-heading font-semibold">Ledger</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Voucher</th>
                  <th className="py-2 pr-2">Head</th>
                  <th className="py-2 pr-2">Paid to</th>
                  <th className="py-2 pr-2">Mode</th>
                  <th className="py-2 pr-2">Reference</th>
                  <th className="py-2 pr-2 text-right">GST</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 align-top">
                    <td className="whitespace-nowrap py-1.5 pr-2">{dateIN(e.spentAt)}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 font-mono">{e.voucherNo}</td>
                    <td className="py-1.5 pr-2">
                      {categoryLabel(e.category)}
                      {e.note && <span className="block text-muted-foreground">{e.note}</span>}
                    </td>
                    <td className="py-1.5 pr-2">{e.payee ?? "-"}</td>
                    <td className="py-1.5 pr-2">{paidFromLabel(e.paidFrom)}</td>
                    <td className="py-1.5 pr-2">{e.reference ?? "-"}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {e.gstAmount ? formatINR(e.gstAmount) : "-"}
                    </td>
                    <td className="whitespace-nowrap py-1.5 text-right font-medium">
                      {e.amount === 0 ? "VOID" : formatINR(e.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 font-bold">
                  <td className="py-2" colSpan={7}>
                    Total
                  </td>
                  <td className="py-2 text-right">{formatINR(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
          Generated from the SLPL expense log on {dateIN(new Date())}. Voided entries are shown with
          their voucher numbers retained, so the numbering has no gaps. Bill photographs are held
          against each entry and can be produced on request.
        </p>
      </article>
    </div>
  );
}
