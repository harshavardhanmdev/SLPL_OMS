export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import QRCode from "qrcode";

import { PrintButton } from "@/components/store/print-button";
import { QuotationStatusControls } from "@/components/erp/quotation-status";
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
import { formatINR } from "@/lib/money";
import { lineTotals, quoteTotals, ratePercent, rupeesInWords } from "@/lib/quotation-math";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Quotation", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** 1,75,000 in the table, as the samples print it, with paise only when there are some. */
const num = (paise: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format(paise / 100);

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Sent back to draft",
  PENDING_APPROVAL: "Waiting for approval",
  APPROVED: "Approved, not yet sent",
  SENT: "Sent to the school",
  ACCEPTED: "Accepted by the school",
  REJECTED: "Not taken up",
  EXPIRED: "Expired",
};

/**
 * The quotation as the school receives it, laid out like the owner's School
 * Radio sample: BILL TO and SHIP TO, expiry date, a discount and a tax column
 * that each show the percentage underneath, and a subtotal row that totals
 * every column.
 *
 * The discount and tax columns appear only when a line uses them, so a plain
 * books quotation still reads like the simpler Cambridge sample.
 */
export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "quotes.read")) redirect("/erp");

  const quotation = await db.quotation.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true } },
    },
  });
  if (!quotation) notFound();
  const company = await getCompany();

  const lines = quotation.items.map((i) => ({
    description: i.description,
    hsnCode: i.hsnCode,
    unit: i.unit,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discountBp: i.discountBp,
    discountAmount: i.discountAmount,
    gstRate: i.gstRate,
  }));
  const perLine = lines.map(lineTotals);
  const totals = quoteTotals(lines, quotation.placeOfSupply);
  const qty = lines.reduce((s, l) => s + l.quantity, 0);
  const showDisc = perLine.some((t) => t.discount > 0);
  const showTax = perLine.some((t) => t.tax > 0);
  const lapsed = quotation.validUntil < new Date() && quotation.status === "SENT";

  const qr =
    company.upiId && totals.total > 0
      ? await QRCode.toString(upiPayload(company, quotation.number), {
          type: "svg",
          margin: 0,
          errorCorrectionLevel: "M",
        })
      : null;

  const th = "px-2 py-2.5 text-right font-semibold print:py-1";
  const td = "px-2 py-2.5 text-right align-top tabular-nums print:py-1";
  const sub = "block text-[10px] font-normal";

  return (
    <div className="mx-auto max-w-4xl">
      <style>{"@media print { @page { size: A4; margin: 8mm; } }"}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link
            href="/erp/quotations"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Back to quotations
          </Link>
          <p className="mt-1 text-sm">
            <span className="font-medium">{STATUS_LABEL[quotation.status] ?? quotation.status}</span>
            {quotation.createdBy ? (
              <span className="text-muted-foreground"> · raised by {quotation.createdBy.name}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuotationStatusControls
            id={quotation.id}
            number={quotation.number}
            status={quotation.status}
            canApprove={roleCan(staff.role, "invoices.approve")}
            canWrite={roleCan(staff.role, "quotes.write")}
            canInvoice={roleCan(staff.role, "invoices.write")}
          />
          <PrintButton label="Print the quotation" />
        </div>
      </div>

      {quotation.rejectedReason && (
        <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
          Sent back by the manager: {quotation.rejectedReason}
        </p>
      )}
      {lapsed && (
        <p className="mb-4 rounded-xl border border-saffron/40 bg-saffron/10 p-3 text-sm text-saffron-deep print:hidden">
          This was valid to {dateIN(quotation.validUntil)} and has passed. Raise a fresh one rather
          than letting a school hold an old price.
        </p>
      )}
      {quotation.status === "PENDING_APPROVAL" && (
        <p className="mb-4 rounded-xl border border-saffron/40 bg-saffron/10 p-3 text-sm text-saffron-deep print:hidden">
          Not approved yet, so it should not go to the school in this state.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl shadow-sm print:overflow-visible print:shadow-none">
        <div className="min-w-[640px] bg-white p-7 text-black print:p-0 print:leading-snug" style={{ color: DOC_NAVY }}>
          <Letterhead company={company} docLabel="QUOTATION" />

          <div
            className="mt-3 flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-xs print:mt-2 print:py-1.5"
            style={{ backgroundColor: "#ececec" }}
          >
            <span>
              <b>Quotation No.:</b> {quotation.number}
            </span>
            <span>
              <b>Quotation Date:</b> {dateIN(quotation.quotedOn)}
            </span>
            <span>
              <b>Expiry Date:</b> {dateIN(quotation.validUntil)}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-6 text-[11px] print:mt-2">
            <div>
              <p className="font-bold uppercase">Bill To</p>
              <p className="mt-1 text-sm font-bold uppercase">{quotation.customerName}</p>
              {quotation.contactPerson && <p>Kind attention: {quotation.contactPerson}</p>}
              {quotation.addressLine && <p>{quotation.addressLine}</p>}
              {(quotation.city || quotation.pincode) && (
                <p>
                  {[quotation.city, quotation.state].filter(Boolean).join(", ")}
                  {quotation.pincode ? ` ${quotation.pincode}` : ""}
                </p>
              )}
              {quotation.gstin && <p>GSTIN: {quotation.gstin}</p>}
              <p className="mt-1">Place of Supply: {quotation.placeOfSupply}</p>
            </div>
            <div>
              <p className="font-bold uppercase">Ship To</p>
              <p className="mt-1 text-sm font-bold uppercase">
                {quotation.shipToName || quotation.customerName}
              </p>
              {quotation.shipToAddress ? (
                <p>{quotation.shipToAddress}</p>
              ) : (
                quotation.addressLine && <p>{quotation.addressLine}</p>
              )}
            </div>
          </div>

          <table className="mt-4 w-full border-collapse text-[11px] print:mt-3">
            <thead>
              <tr style={{ borderTop: `2px solid ${DOC_BLUE}`, borderBottom: `2px solid ${DOC_BLUE}` }}>
                <th className="px-2 py-2.5 text-left font-semibold uppercase print:py-1">
                  {showTax || showDisc ? "Items/Services" : "Items"}
                </th>
                <th className={th}>QTY.</th>
                <th className={th}>RATE</th>
                {showDisc && <th className={th}>DISC.</th>}
                {showTax && <th className={th}>TAX</th>}
                <th className={th}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item, i) => {
                const t = perLine[i];
                const discPct = t.gross > 0 ? Math.round((t.discount / t.gross) * 10000) : 0;
                return (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${DOC_RULE}` }}>
                    <td className="px-2 py-2.5 align-top uppercase print:py-1">
                      {item.description}
                      {item.hsnCode && showTax && (
                        <span className={sub} style={{ color: DOC_MUTED }}>
                          {item.gstRate > 0 ? "SAC" : "HSN"} {item.hsnCode}
                        </span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {item.quantity} {item.unit.toUpperCase()}
                    </td>
                    <td className={td}>{num(item.unitPrice)}</td>
                    {showDisc && (
                      <td className={td}>
                        {num(t.discount)}
                        <span className={sub} style={{ color: DOC_MUTED }}>
                          ({ratePercent(discPct)})
                        </span>
                      </td>
                    )}
                    {showTax && (
                      <td className={td}>
                        {num(t.tax)}
                        <span className={sub} style={{ color: DOC_MUTED }}>
                          ({ratePercent(t.taxable > 0 ? item.gstRate : 0)})
                        </span>
                      </td>
                    )}
                    <td className={td}>{num(t.total)}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: `2px solid ${DOC_BLUE}`, borderBottom: `2px solid ${DOC_BLUE}` }}>
                <td className="px-2 py-2.5 font-bold uppercase print:py-1">Subtotal</td>
                <td className={`${td} font-bold`}>{qty}</td>
                <td className={td} />
                {showDisc && <td className={`${td} font-bold`}>{formatINR(totals.discount)}</td>}
                {showTax && (
                  <td className={`${td} font-bold`}>
                    {formatINR(totals.cgst + totals.sgst + totals.igst)}
                  </td>
                )}
                <td className={`${td} font-bold`}>{formatINR(totals.total)}</td>
              </tr>
            </tbody>
          </table>

          {/* Bank and QR on the left, the money and the terms on the right, then
              the signatures. One block that never splits, so the totals and the
              signature always print on the same sheet */}
          <div className="mt-4 break-inside-avoid print:mt-3">
            <div className="grid grid-cols-2 gap-6">
              <BankBlock company={company} qrSvg={qr} amount={totals.total} amountLabel="Quotation total" />

              <div className="text-[11px]">
                <dl className="ml-auto max-w-xs space-y-1">
                  {showTax && (
                    <div className="flex justify-between">
                      <dt>Taxable Amount</dt>
                      <dd className="tabular-nums">{formatINR(totals.taxable)}</dd>
                    </div>
                  )}
                  {totals.byRate
                    .filter((r) => r.rate > 0)
                    .map((r) =>
                      totals.interState ? (
                        <div key={r.rate} className="flex justify-between">
                          <dt>IGST @{ratePercent(r.rate)}</dt>
                          <dd className="tabular-nums">{formatINR(r.tax)}</dd>
                        </div>
                      ) : (
                        <div key={r.rate} className="space-y-1">
                          <div className="flex justify-between">
                            <dt>CGST @{ratePercent(r.rate / 2)}</dt>
                            <dd className="tabular-nums">{formatINR(r.cgst)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>SGST @{ratePercent(r.rate / 2)}</dt>
                            <dd className="tabular-nums">{formatINR(r.sgst)}</dd>
                          </div>
                        </div>
                      ),
                    )}
                  <div
                    className="flex justify-between border-y py-1.5 text-sm font-bold"
                    style={{ borderColor: DOC_RULE }}
                  >
                    <dt>Total Amount</dt>
                    <dd className="tabular-nums">{formatINR(totals.total)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-right print:mt-2">
                  <span className="block font-bold">Total Amount (in words)</span>
                  {rupeesInWords(totals.total).replace(/ Only$/, "")}
                </p>
                <TermsBlock terms={quotation.terms} />
                <p className="mt-2 text-[10px] leading-snug" style={{ color: DOC_MUTED }}>
                  This is a quotation, not a demand for payment. Please quote {quotation.number} when
                  placing the order.
                </p>
              </div>
            </div>

            <SignatureBlock company={company} />
          </div>
        </div>
      </div>
    </div>
  );
}
