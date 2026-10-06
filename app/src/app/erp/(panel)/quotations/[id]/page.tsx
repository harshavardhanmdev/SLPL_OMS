export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { PrintButton } from "@/components/store/print-button";
import { QuotationStatusControls } from "@/components/erp/quotation-status";
import { getSetting } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { lineTotals, quoteTotals, ratePercent, rupeesInWords } from "@/lib/quotation-math";
import { site } from "@/lib/site";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Quotation", robots: { index: false } };

const NAVY = "#1E2A5A";
const SAFFRON = "#F5A623";
const MUTED = "#5a6478";

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

/**
 * The quotation as the school receives it, on letterhead.
 *
 * Colours are literal hex rather than theme tokens, because this is printed
 * and must not follow the reader's dark mode.
 */
export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [quotation, gstin, staff] = await Promise.all([
    db.quotation.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: "asc" } }, createdBy: { select: { name: true } } },
    }),
    getSetting<string>("company_gstin", ""),
    getStaff(),
  ]);
  if (!quotation) notFound();

  const canWrite = staff ? roleCan(staff.role, "quotes.write") : false;
  const lines = quotation.items.map((i) => ({
    description: i.description,
    hsnCode: i.hsnCode,
    unit: i.unit,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discountBp: i.discountBp,
    gstRate: i.gstRate,
  }));
  const totals = quoteTotals(lines, quotation.placeOfSupply);
  const lapsed = quotation.validUntil < new Date() && quotation.status === "SENT";

  const th = "px-2 py-2 text-right font-semibold";
  const td = "px-2 py-2 text-right tabular-nums";

  return (
    <div className="mx-auto max-w-4xl">
      <style>{"@media print { @page { size: A4; margin: 12mm; } }"}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/erp/quotations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to quotations
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <QuotationStatusControls
              id={quotation.id}
              number={quotation.number}
              status={quotation.status}
            />
          )}
          <PrintButton label="Print the quotation" />
        </div>
      </div>

      {lapsed && (
        <p className="mb-4 rounded-xl border border-saffron/40 bg-saffron/10 p-3 text-sm text-saffron-deep print:hidden">
          This was valid to {dateIN(quotation.validUntil)} and has passed. Raise a fresh one rather
          than letting a school hold an old price.
        </p>
      )}

      <div className="bg-white p-8 text-black" style={{ color: NAVY }}>
        <header className="flex items-start gap-4 border-b-2 pb-4" style={{ borderColor: SAFFRON }}>
          <Image
            src="/brand/sl-logo.png"
            alt=""
            width={60}
            height={60}
            className="size-15 object-contain"
          />
          <div className="flex-1">
            <p className="font-heading text-xl font-bold">{site.company}</p>
            <p className="text-sm">{site.contact.address}</p>
            <p className="text-xs" style={{ color: MUTED }}>
              {site.contact.phone} · {site.contact.email} · theslpl.in
              {gstin ? ` · GSTIN ${gstin}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="font-heading text-lg font-bold">QUOTATION</p>
            <p className="font-mono text-sm">{quotation.number}</p>
            <p className="text-xs" style={{ color: MUTED }}>
              {dateIN(quotation.quotedOn)}
            </p>
          </div>
        </header>

        <section className="mt-5 flex flex-wrap justify-between gap-6 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase" style={{ color: MUTED }}>
              Quotation for
            </p>
            <p className="font-semibold">{quotation.customerName}</p>
            {quotation.contactPerson && <p>Kind attention: {quotation.contactPerson}</p>}
            {quotation.addressLine && <p>{quotation.addressLine}</p>}
            {(quotation.city || quotation.pincode) && (
              <p>
                {[quotation.city, quotation.state].filter(Boolean).join(", ")}
                {quotation.pincode ? ` - ${quotation.pincode}` : ""}
              </p>
            )}
            {quotation.phone && <p>{quotation.phone}</p>}
            {quotation.email && <p>{quotation.email}</p>}
            {quotation.gstin && <p className="mt-1">GSTIN {quotation.gstin}</p>}
          </div>
          <div className="text-right text-sm">
            <p>
              <span style={{ color: MUTED }}>Place of supply: </span>
              {quotation.placeOfSupply}
            </p>
            <p>
              <span style={{ color: MUTED }}>Valid until: </span>
              {dateIN(quotation.validUntil)}
            </p>
            {quotation.createdBy && (
              <p>
                <span style={{ color: MUTED }}>Raised by: </span>
                {quotation.createdBy.name}
              </p>
            )}
          </div>
        </section>

        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: NAVY, color: "#ffffff" }}>
              <th className="px-2 py-2 text-left font-semibold">#</th>
              <th className="px-2 py-2 text-left font-semibold">Particulars</th>
              <th className={th}>HSN</th>
              <th className={th}>Qty</th>
              <th className={th}>Rate</th>
              <th className={th}>Taxable</th>
              <th className={th}>GST</th>
              <th className={th}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item, i) => {
              const t = lineTotals(lines[i]);
              return (
                <tr key={item.id} className="border-b" style={{ borderColor: "#e3e8f2" }}>
                  <td className="px-2 py-2">{i + 1}</td>
                  <td className="px-2 py-2">
                    {item.description}
                    {item.discountBp > 0 && (
                      <span className="block text-xs" style={{ color: MUTED }}>
                        less {ratePercent(item.discountBp)} discount
                      </span>
                    )}
                  </td>
                  <td className={td}>{item.hsnCode ?? "-"}</td>
                  <td className={td}>
                    {item.quantity} {item.unit}
                  </td>
                  <td className={td}>{formatINR(item.unitPrice)}</td>
                  <td className={td}>{formatINR(t.taxable)}</td>
                  <td className={td}>
                    {item.gstRate === 0 ? "Nil" : `${ratePercent(item.gstRate)} ${formatINR(t.tax)}`}
                  </td>
                  <td className={`${td} font-semibold`}>{formatINR(t.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap justify-end">
          <dl className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt style={{ color: MUTED }}>Taxable value</dt>
              <dd className="tabular-nums">{formatINR(totals.taxable)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between">
                <dt style={{ color: MUTED }}>Discount allowed</dt>
                <dd className="tabular-nums">{formatINR(totals.discount)}</dd>
              </div>
            )}
            {!totals.interState && totals.cgst > 0 && (
              <>
                <div className="flex justify-between">
                  <dt style={{ color: MUTED }}>CGST</dt>
                  <dd className="tabular-nums">{formatINR(totals.cgst)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt style={{ color: MUTED }}>SGST</dt>
                  <dd className="tabular-nums">{formatINR(totals.sgst)}</dd>
                </div>
              </>
            )}
            {totals.interState && totals.igst > 0 && (
              <div className="flex justify-between">
                <dt style={{ color: MUTED }}>IGST</dt>
                <dd className="tabular-nums">{formatINR(totals.igst)}</dd>
              </div>
            )}
            <div
              className="flex justify-between border-t-2 pt-2 font-heading text-base font-bold"
              style={{ borderColor: NAVY }}
            >
              <dt>Total</dt>
              <dd className="tabular-nums">{formatINR(totals.total)}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-2 text-right text-xs" style={{ color: MUTED }}>
          {rupeesInWords(totals.total)}
        </p>

        {totals.byRate.some((r) => r.rate === 0) && (
          <p className="mt-3 text-xs" style={{ color: MUTED }}>
            Printed books are nil rated under HSN 4901.
          </p>
        )}

        {quotation.terms && (
          <section className="mt-5 border-t pt-3" style={{ borderColor: "#e3e8f2" }}>
            <p className="mb-1 text-xs font-semibold uppercase" style={{ color: MUTED }}>
              Terms
            </p>
            <ul className="list-inside list-disc text-xs leading-relaxed">
              {quotation.terms
                .split("\n")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
            </ul>
          </section>
        )}

        <footer
          className="mt-8 flex items-end justify-between border-t pt-4 text-xs"
          style={{ borderColor: "#e3e8f2", color: MUTED }}
        >
          <p>
            This is a quotation and not a demand for payment.
            <br />
            Please quote {quotation.number} when placing an order.
          </p>
          <p className="text-right">
            For {site.company}
            <br />
            <span className="mt-6 block">Authorised signatory</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
