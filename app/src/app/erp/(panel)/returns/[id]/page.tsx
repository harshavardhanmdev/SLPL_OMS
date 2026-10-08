export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { DeleteReturn } from "@/components/erp/return-form";
import { PrintButton } from "@/components/store/print-button";
import {
  DOC_BLUE,
  DOC_MUTED,
  DOC_NAVY,
  DOC_RULE,
  Letterhead,
  SignatureBlock,
  TermsBlock,
} from "@/components/erp/letterhead";
import { getCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { rupeesInWords } from "@/lib/quotation-math";
import { getStaff, roleCan } from "@/lib/staff-auth";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const doc = await db.salesReturn.findUnique({
    where: { id },
    select: { number: true, customerName: true },
  });
  return {
    title: {
      absolute: doc ? `Sales return ${doc.number.replace(/\//g, "-")} ${doc.customerName}` : "Sales return",
    },
    robots: { index: false },
  };
}

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

const TERMS = [
  "Refunds and returns are as per signed MOU.",
  "All disputes are subject to Hyderabad jurisdiction only.",
].join("\n");

/** A sales return as the school receives it, laid out like the owner's own. */
export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "invoices.read")) redirect("/erp");

  const doc = await db.salesReturn.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, invoice: { select: { id: true, number: true } } },
  });
  if (!doc) notFound();
  const company = await getCompany();
  const qty = doc.items.reduce((s, i) => s + i.quantity, 0);
  const th = "px-2 py-2 text-right font-semibold print:py-1";
  const td = "px-2 py-2 text-right tabular-nums print:py-1";

  return (
    <div className="mx-auto max-w-4xl">
      <style>{"@media print { @page { size: A4; margin: 0; } }"}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/erp/returns"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to returns
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {roleCan(staff.role, "staff.manage") && <DeleteReturn id={doc.id} number={doc.number} />}
          <PrintButton label="Print the return" />
        </div>
      </div>
      {(doc.invoice || doc.reason) && (
        <p className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground print:hidden">
          {doc.invoice && (
            <span>
              Against{" "}
              <Link
                href={`/erp/invoices/${doc.invoice.id}`}
                className="font-medium text-foreground underline"
              >
                {doc.invoice.number}
              </Link>
            </span>
          )}
          {doc.reason && <span>{doc.reason}</span>}
        </p>
      )}

      <div className="bg-white p-7 text-black print:p-[8mm] print:leading-snug" style={{ color: DOC_NAVY }}>
        <Letterhead company={company} docLabel="SALES RETURN" />

        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs font-bold print:mt-2 print:py-1.5"
          style={{ backgroundColor: "#eef2f7" }}
        >
          <span>Return No.: {doc.number}</span>
          <span>Return Date: {dateIN(doc.returnedOn)}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-6 text-[11px] print:mt-2">
          <div>
            <p className="font-bold uppercase">Party name</p>
            <p className="text-sm font-bold">{doc.customerName}</p>
            {doc.phone && <p>Mobile: {doc.phone}</p>}
            <p className="mt-1">Place of Supply: {doc.placeOfSupply}</p>
          </div>
          <div>
            <p className="font-bold uppercase">Ship from</p>
            <p className="text-sm font-bold">{doc.customerName}</p>
          </div>
        </div>

        <table className="mt-4 w-full border-collapse text-[11px] print:mt-3">
          <thead>
            <tr style={{ borderTop: `2px solid ${DOC_BLUE}`, borderBottom: `2px solid ${DOC_BLUE}` }}>
              <th className="px-2 py-2 text-left font-semibold uppercase print:py-1">Items</th>
              <th className={th}>HSN</th>
              <th className={th}>Qty.</th>
              <th className={th}>MRP</th>
              <th className={th}>Rate</th>
              <th className={th}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item) => (
              <tr key={item.id} style={{ borderBottom: `1px solid ${DOC_RULE}` }}>
                <td className="px-2 py-2 uppercase print:py-1">{item.description}</td>
                <td className={td}>{item.hsnCode || "-"}</td>
                <td className={`${td} whitespace-nowrap`}>
                  {item.quantity} {item.unit}
                </td>
                <td className={td} style={{ color: DOC_MUTED }}>
                  {item.mrp ? formatINR(item.mrp) : "-"}
                </td>
                <td className={td}>{formatINR(item.rate)}</td>
                <td className={`${td} font-semibold`}>{formatINR(item.amount)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: `2px solid ${DOC_BLUE}`, borderBottom: `2px solid ${DOC_BLUE}` }}>
              <td className="px-2 py-2 font-bold uppercase print:py-1">Subtotal</td>
              <td className={td} />
              <td className={`${td} font-bold`}>{qty}</td>
              <td className={td} colSpan={2} />
              <td className={`${td} font-bold`}>{formatINR(doc.total)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 grid break-inside-avoid grid-cols-2 gap-6 print:mt-3">
          <div className="text-[11px]">
            <TermsBlock terms={TERMS} />
          </div>
          <div className="text-[11px]">
            <dl className="ml-auto max-w-xs space-y-1">
              <div
                className="flex justify-between border-y py-1 text-sm font-bold"
                style={{ borderColor: DOC_RULE }}
              >
                <dt>Total Amount</dt>
                <dd className="tabular-nums">{formatINR(doc.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: DOC_MUTED }}>Paid Amount</dt>
                <dd className="tabular-nums">{formatINR(doc.refunded)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-right">
              <span className="block font-bold">Total Amount (in words)</span>
              {rupeesInWords(doc.total).replace(/ Only$/, "")}
            </p>
          </div>
        </div>

        <SignatureBlock company={company} />
      </div>
    </div>
  );
}
