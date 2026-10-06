export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import QRCode from "qrcode";

import { PrintButton } from "@/components/store/print-button";
import { InvoiceDecisions } from "@/components/erp/invoice-decisions";
import {
  BankBlock,
  DOC_BLUE,
  DOC_MUTED,
  DOC_NAVY,
  DOC_RULE,
  Letterhead,
  SignatureBlock,
} from "@/components/erp/letterhead";
import { getCompany, upiPayload } from "@/lib/company";
import { db } from "@/lib/db";
import { invoiceBalances } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { documentTotals, lineTotals, ratePercent, rupeesInWords } from "@/lib/quotation-math";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * The bill as a school receives it.
 *
 * The title is decided by the lines, not by a dropdown: nil rated throughout
 * is a Bill of Supply, anything taxed is a Tax Invoice. Tax columns appear
 * only when there is tax, so a books-only bill reads exactly like the owner's
 * sample.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true } },
    },
  });
  if (!invoice) notFound();

  const company = await getCompany();
  const balances = await invoiceBalances(invoice.id);

  const lines = invoice.items.map((i) => ({
    description: i.description,
    hsnCode: i.hsnCode,
    unit: i.unit,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discountBp: i.discountBp,
    gstRate: i.gstRate,
  }));
  const totals = documentTotals(lines, invoice.placeOfSupply, invoice.billDiscountBp);
  const taxed = invoice.kind === "TAX_INVOICE";
  const qty = invoice.items.reduce((s, i) => s + i.quantity, 0);

  const qr = company.upiId
    ? await QRCode.toString(upiPayload(company, invoice.total, invoice.number), {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
      })
    : null;

  const th = "px-2 py-2 text-right font-semibold";
  const td = "px-2 py-2 text-right tabular-nums";

  return (
    <div className="mx-auto max-w-4xl">
      <style>{"@media print { @page { size: A4; margin: 10mm; } }"}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/erp/invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceDecisions
            id={invoice.id}
            number={invoice.number}
            status={invoice.status}
            canApprove={roleCan(staff.role, "invoices.approve")}
            canWrite={roleCan(staff.role, "invoices.write")}
          />
          <PrintButton label="Print the invoice" />
        </div>
      </div>

      {invoice.rejectedReason && (
        <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
          Sent back by the manager: {invoice.rejectedReason}
        </p>
      )}

      <div className="bg-white p-7 text-black" style={{ color: DOC_NAVY }}>
        <Letterhead
          company={company}
          docLabel={taxed ? "TAX INVOICE" : "BILL OF SUPPLY"}
          badge="ORIGINAL"
        />

        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs font-bold"
          style={{ backgroundColor: "#eef2f7" }}
        >
          <span>Invoice No.: {invoice.number}</span>
          <span>Invoice Date: {dateIN(invoice.invoiceDate)}</span>
          <span>Due Date: {dateIN(invoice.dueDate)}</span>
        </div>

        <div className="mt-3 text-[11px]">
          <p className="font-bold uppercase">Bill To</p>
          <p className="text-sm font-bold">{invoice.customerName}</p>
          {invoice.contactPerson && <p>Kind attention: {invoice.contactPerson}</p>}
          {invoice.addressLine && <p>{invoice.addressLine}</p>}
          {(invoice.city || invoice.pincode) && (
            <p>
              {[invoice.city, invoice.state].filter(Boolean).join(", ")}
              {invoice.pincode ? ` - ${invoice.pincode}` : ""}
            </p>
          )}
          {invoice.gstin && <p>GSTIN: {invoice.gstin}</p>}
          <p className="mt-1">Place of Supply: {invoice.placeOfSupply}</p>
        </div>

        <table className="mt-4 w-full border-collapse text-[11px]">
          <thead>
            <tr style={{ borderBottom: `2px solid ${DOC_BLUE}` }}>
              <th className="px-2 py-2 text-left font-semibold uppercase">Items</th>
              {taxed && <th className={th}>HSN</th>}
              <th className={th}>Qty.</th>
              {invoice.items.some((i) => i.mrp) && <th className={th}>MRP</th>}
              <th className={th}>Rate</th>
              {taxed && <th className={th}>GST</th>}
              <th className={th}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => {
              const t = lineTotals(lines[i]);
              return (
                <tr key={item.id} style={{ borderBottom: `1px solid ${DOC_RULE}` }}>
                  <td className="px-2 py-2 uppercase">{item.description}</td>
                  {taxed && <td className={td}>{item.hsnCode ?? "-"}</td>}
                  <td className={td}>
                    {item.quantity} {item.unit}
                  </td>
                  {invoice.items.some((x) => x.mrp) && (
                    <td className={td} style={{ color: DOC_MUTED }}>
                      {item.mrp ? formatINR(item.mrp) : "-"}
                    </td>
                  )}
                  <td className={td}>{formatINR(item.unitPrice)}</td>
                  {taxed && (
                    <td className={td}>
                      {item.gstRate === 0 ? "Nil" : ratePercent(item.gstRate)}
                    </td>
                  )}
                  <td className={`${td} font-semibold`}>{formatINR(t.gross)}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: `2px solid ${DOC_BLUE}`, borderBottom: `2px solid ${DOC_BLUE}` }}>
              <td className="px-2 py-2 font-bold uppercase">Subtotal</td>
              <td className={`${td} font-bold`} colSpan={taxed ? 2 : 1}>
                {qty}
              </td>
              <td
                className={`${td} font-bold`}
                colSpan={(invoice.items.some((x) => x.mrp) ? 1 : 0) + (taxed ? 2 : 1)}
              >
                {formatINR(totals.subtotal)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap justify-between gap-6">
          <BankBlock company={company} qrSvg={qr} />

          <dl className="w-full max-w-xs space-y-1 text-[11px]">
            {totals.discount > 0 && (
              <div className="flex justify-between">
                <dt style={{ color: DOC_MUTED }}>
                  Discount
                  {invoice.billDiscountBp > 0 ? ` (${ratePercent(invoice.billDiscountBp)})` : ""}
                </dt>
                <dd className="tabular-nums">- {formatINR(totals.discount)}</dd>
              </div>
            )}
            {taxed && !totals.interState && (
              <>
                <div className="flex justify-between">
                  <dt style={{ color: DOC_MUTED }}>CGST</dt>
                  <dd className="tabular-nums">{formatINR(totals.cgst)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt style={{ color: DOC_MUTED }}>SGST</dt>
                  <dd className="tabular-nums">{formatINR(totals.sgst)}</dd>
                </div>
              </>
            )}
            {taxed && totals.interState && (
              <div className="flex justify-between">
                <dt style={{ color: DOC_MUTED }}>IGST</dt>
                <dd className="tabular-nums">{formatINR(totals.igst)}</dd>
              </div>
            )}
            <div
              className="flex justify-between border-y py-1 text-sm font-bold"
              style={{ borderColor: DOC_RULE }}
            >
              <dt>Total Amount</dt>
              <dd className="tabular-nums">{formatINR(totals.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: DOC_MUTED }}>Received Amount</dt>
              <dd className="tabular-nums">{formatINR(balances.receivedAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: DOC_MUTED }}>Previous Balance</dt>
              <dd className="tabular-nums">{formatINR(balances.previousBalance)}</dd>
            </div>
            <div className="flex justify-between font-bold">
              <dt>Current Balance</dt>
              <dd className="tabular-nums">{formatINR(balances.currentBalance)}</dd>
            </div>
            <p className="pt-2 text-right" style={{ color: DOC_MUTED }}>
              <span className="block font-bold" style={{ color: DOC_NAVY }}>
                Total Amount (in words)
              </span>
              {rupeesInWords(totals.total)}
            </p>
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div className="text-[11px]">
            {invoice.terms && (
              <>
                <p className="mb-1 font-bold uppercase">Terms and Conditions</p>
                <ol className="list-inside list-decimal leading-relaxed">
                  {invoice.terms
                    .split("\n")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                </ol>
              </>
            )}
            {!taxed && (
              <p className="mt-2" style={{ color: DOC_MUTED }}>
                Printed books are exempt under HSN 4901, so no tax is charged and this is a bill of
                supply rather than a tax invoice.
              </p>
            )}
          </div>
          <SignatureBlock company={company} />
        </div>
      </div>
    </div>
  );
}
