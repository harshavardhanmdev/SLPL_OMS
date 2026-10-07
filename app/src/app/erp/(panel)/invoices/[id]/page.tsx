export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Truck } from "lucide-react";
import QRCode from "qrcode";

import { PrintButton } from "@/components/store/print-button";
import { Button } from "@/components/ui/button";
import { InvoiceDecisions } from "@/components/erp/invoice-decisions";
import {
  BankBlock,
  DOC_BLUE,
  DOC_MUTED,
  DOC_NAVY,
  DOC_RULE,
  Letterhead,
  SignatureBlock,
  TermsBlock,
} from "@/components/erp/letterhead";
import { getCompany, upiPayload } from "@/lib/company";
import { db } from "@/lib/db";
import { invoiceBalances } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { documentTotals, lineTotals, ratePercent, rupeesInWords } from "@/lib/quotation-math";
import { getStaff, roleCan } from "@/lib/staff-auth";

/** Named after the document, so "Save as PDF" suggests a sensible file name. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const doc = await db.invoice.findUnique({ where: { id }, select: { number: true } });
  return {
    title: { absolute: doc ? `Invoice ${doc.number.replace(/\//g, "-")}` : "Invoice" },
    robots: { index: false },
  };
}

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
      visits: { select: { id: true, visitedOn: true, by: { select: { name: true } } } },
      challans: { select: { id: true, number: true } },
    },
  });
  if (!invoice) notFound();
  const quotation = invoice.quotationId
    ? await db.quotation.findUnique({
        where: { id: invoice.quotationId },
        select: { id: true, number: true },
      })
    : null;

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
    noBillDiscount: i.noBillDiscount,
  }));
  const totals = documentTotals(lines, invoice.placeOfSupply, invoice.billDiscountBp);
  const taxed = invoice.kind === "TAX_INVOICE";
  const qty = invoice.items.reduce((s, i) => s + i.quantity, 0);

  const qr = company.upiId
    ? await QRCode.toString(upiPayload(company, invoice.number), {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
      })
    : null;

  const th = "px-2 py-2 text-right font-semibold print:py-1";
  const td = "px-2 py-2 text-right tabular-nums print:py-1";

  return (
    <div className="mx-auto max-w-4xl">
      {/* No page margin, so the browser has nowhere to print its own title and
          web address; the document carries its own 8mm margin instead */}
      <style>{"@media print { @page { size: A4; margin: 0; } }"}</style>

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
            canDelete={roleCan(staff.role, "staff.manage") && balances.receivedAmount === 0}
          />
          {roleCan(staff.role, "challan.write") &&
            ["APPROVED", "SENT", "PAID"].includes(invoice.status) && (
              <Button variant="outline" className="gap-2" asChild>
                <Link href={`/erp/challans/new?invoiceId=${invoice.id}`}>
                  <Truck className="size-4" /> Delivery challan
                </Link>
              </Button>
            )}
          <PrintButton label="Print the invoice" />
        </div>
      </div>

      {(quotation || invoice.visits.length > 0 || invoice.challans.length > 0) && (
        <p className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground print:hidden">
          {quotation && (
            <span>
              From quotation{" "}
              <Link href={`/erp/quotations/${quotation.id}`} className="font-medium text-foreground underline">
                {quotation.number}
              </Link>
            </span>
          )}
          {invoice.visits.map((v) => (
            <span key={v.id}>
              Won on the visit of {v.visitedOn.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              {v.by ? ` by ${v.by.name}` : ""}
            </span>
          ))}
          {invoice.challans.map((c) => (
            <span key={c.id}>
              Delivered on{" "}
              <Link href={`/erp/challans/${c.id}`} className="font-medium text-foreground underline">
                {c.number}
              </Link>
            </span>
          ))}
        </p>
      )}

      {invoice.rejectedReason && (
        <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
          Sent back by the manager: {invoice.rejectedReason}
        </p>
      )}

      <div className="bg-white p-7 text-black print:p-[8mm] print:leading-snug" style={{ color: DOC_NAVY }}>
        <Letterhead
          company={company}
          docLabel={taxed ? "TAX INVOICE" : "BILL OF SUPPLY"}
          badge="ORIGINAL"
        />

        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs font-bold print:mt-2 print:py-1.5"
          style={{ backgroundColor: "#eef2f7" }}
        >
          <span>Invoice No.: {invoice.number}</span>
          <span>Invoice Date: {dateIN(invoice.invoiceDate)}</span>
          <span>Due Date: {dateIN(invoice.dueDate)}</span>
        </div>

        <div className="mt-3 text-[11px] print:mt-2">
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

        <table className="mt-4 w-full border-collapse text-[11px] print:mt-3">
          <thead>
            <tr style={{ borderBottom: `2px solid ${DOC_BLUE}` }}>
              <th className="px-2 py-2 text-left font-semibold uppercase print:py-1">Items</th>
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
                  <td className="px-2 py-2 uppercase print:py-1">
                    {item.description}
                    {item.noBillDiscount && invoice.billDiscountBp > 0 && (
                      <span className="block text-[10px] normal-case" style={{ color: DOC_MUTED }}>
                        Not discounted
                      </span>
                    )}
                  </td>
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
              <td className="px-2 py-2 font-bold uppercase print:py-1">Subtotal</td>
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

        {/* Bank and QR on the left, the money and the terms on the right, then
            the signatures. One block that never splits, so the totals and the
            signature always print on the same sheet */}
        <div className="mt-4 break-inside-avoid print:mt-3">
          <div className="grid gap-6 sm:grid-cols-2">
            <BankBlock
              company={company}
              qrSvg={qr}
              amount={invoice.total - balances.receivedAmount}
            />

            <div className="text-[11px]">
              <dl className="ml-auto w-full max-w-xs space-y-1">
                {totals.discount > 0 && (
                  <div className="flex justify-between">
                    <dt style={{ color: DOC_MUTED }}>
                      Discount
                      {invoice.billDiscountBp > 0 ? ` (${ratePercent(invoice.billDiscountBp)})` : ""}
                    </dt>
                    <dd className="tabular-nums">- {formatINR(totals.discount)}</dd>
                  </div>
                )}
                {taxed && (
                  <div className="flex justify-between">
                    <dt style={{ color: DOC_MUTED }}>Taxable Amount</dt>
                    <dd className="tabular-nums">{formatINR(totals.taxable)}</dd>
                  </div>
                )}
                {taxed &&
                  totals.byRate
                    .filter((r) => r.rate > 0)
                    .map((r) =>
                      totals.interState ? (
                        <div key={r.rate} className="flex justify-between">
                          <dt style={{ color: DOC_MUTED }}>IGST @{ratePercent(r.rate)}</dt>
                          <dd className="tabular-nums">{formatINR(r.tax)}</dd>
                        </div>
                      ) : (
                        <div key={r.rate} className="space-y-1">
                          <div className="flex justify-between">
                            <dt style={{ color: DOC_MUTED }}>CGST @{ratePercent(r.rate / 2)}</dt>
                            <dd className="tabular-nums">{formatINR(r.cgst)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt style={{ color: DOC_MUTED }}>SGST @{ratePercent(r.rate / 2)}</dt>
                            <dd className="tabular-nums">{formatINR(r.sgst)}</dd>
                          </div>
                        </div>
                      ),
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
                <p className="pt-2 text-right print:pt-1" style={{ color: DOC_MUTED }}>
                  <span className="block font-bold" style={{ color: DOC_NAVY }}>
                    Total Amount (in words)
                  </span>
                  {rupeesInWords(totals.total)}
                </p>
              </dl>
              <TermsBlock terms={invoice.terms} />
              {!taxed && (
                <p className="mt-2 text-[10px] leading-snug" style={{ color: DOC_MUTED }}>
                  Printed books are exempt under HSN 4901, so no tax is charged and this is a bill of
                  supply rather than a tax invoice.
                </p>
              )}
            </div>
          </div>

          <SignatureBlock company={company} />
        </div>
      </div>
    </div>
  );
}
