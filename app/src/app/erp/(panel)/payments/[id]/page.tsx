export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { PrintButton } from "@/components/store/print-button";
import { DOC_MUTED, DOC_NAVY, DOC_RULE, Letterhead, SignatureBlock } from "@/components/erp/letterhead";
import { getCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { PAYMENT_MODE_LABEL } from "@/lib/payment-modes";
import { rupeesInWords } from "@/lib/quotation-math";
import { getStaff, roleCan } from "@/lib/staff-auth";

/** Named after the receipt, so "Save as PDF" suggests a sensible file name. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await db.receipt.findUnique({ where: { id }, select: { number: true } });
  return { title: { absolute: r ? `Receipt ${r.number.replace(/\//g, "-")}` : "Receipt" }, robots: { index: false } };
}

const dateIN = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * The receipt a school is given for money received. Generated from the payment
 * itself, so its number, amount and the bills it settled can never disagree
 * with the ledger. A voided payment still opens, clearly marked, because the
 * number must stay accountable.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (!staff || !(roleCan(staff.role, "finance.read") || roleCan(staff.role, "crm.read"))) redirect("/erp");

  const receipt = await db.receipt.findUnique({
    where: { id },
    include: {
      organization: true,
      allocations: { include: { invoice: { select: { id: true, number: true, invoiceDate: true, total: true } } } },
    },
  });
  if (!receipt) notFound();

  const company = await getCompany();
  const applied = receipt.allocations.reduce((s, a) => s + a.amount, 0);
  const onAccount = receipt.amount - applied;
  const org = receipt.organization;

  return (
    <div className="mx-auto max-w-3xl">
      {/* No page margin, so the browser prints no title or web address of its own */}
      <style>{"@media print { @page { size: A4; margin: 0; } }"}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/erp/payments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Back to payments
        </Link>
        <PrintButton label="Print the receipt" />
      </div>

      {receipt.voidedAt && (
        <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
          This payment was voided{receipt.voidReason ? `: ${receipt.voidReason}` : ""}. The receipt is kept so its number stays on record.
        </p>
      )}

      <div className="relative overflow-hidden rounded-xl bg-white p-7 text-black shadow-sm print:rounded-none print:p-[8mm] print:shadow-none" style={{ color: DOC_NAVY }}>
        {receipt.voidedAt && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[120px] font-black tracking-widest opacity-10"
            style={{ transform: "rotate(-24deg)", color: "#c0392b" }}
          >
            VOID
          </span>
        )}
        <Letterhead company={company} docLabel="PAYMENT RECEIPT" />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs font-bold" style={{ backgroundColor: "#eef2f7" }}>
          <span>Receipt No.: {receipt.number}</span>
          <span>Date: {dateIN(receipt.receivedOn)}</span>
          <span>Mode: {PAYMENT_MODE_LABEL[receipt.mode] ?? receipt.mode}</span>
        </div>

        <div className="mt-4 text-[12px] leading-relaxed">
          <p className="font-bold uppercase">Received with thanks from</p>
          <p className="text-sm font-bold uppercase">{org.name}</p>
          {org.addressLine && <p>{org.addressLine}</p>}
          {(org.city || org.pincode) && (
            <p>
              {[org.city, org.state].filter(Boolean).join(", ")}
              {org.pincode ? ` ${org.pincode}` : ""}
            </p>
          )}
          {org.gstin && <p>GSTIN: {org.gstin}</p>}
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-lg border px-4 py-3" style={{ borderColor: DOC_RULE }}>
          <div>
            <p className="text-[11px] uppercase" style={{ color: DOC_MUTED }}>Amount received</p>
            <p className="font-heading text-2xl font-bold">{formatINR(receipt.amount)}</p>
            <p className="text-[12px]">{rupeesInWords(receipt.amount)}</p>
          </div>
          {receipt.reference && (
            <p className="text-right text-[12px]">
              <span className="block uppercase" style={{ color: DOC_MUTED }}>Reference</span>
              {receipt.reference}
            </p>
          )}
        </div>

        <table className="mt-4 w-full border-collapse text-[12px]">
          <thead>
            <tr style={{ borderTop: `2px solid ${DOC_NAVY}`, borderBottom: `2px solid ${DOC_NAVY}` }}>
              <th className="px-2 py-2 text-left font-semibold">Against bill</th>
              <th className="px-2 py-2 text-left font-semibold">Bill date</th>
              <th className="px-2 py-2 text-right font-semibold">Bill total</th>
              <th className="px-2 py-2 text-right font-semibold">Paid now</th>
            </tr>
          </thead>
          <tbody>
            {receipt.allocations.map((a) => (
              <tr key={a.id} style={{ borderBottom: `1px solid ${DOC_RULE}` }}>
                <td className="px-2 py-2">{a.invoice.number}</td>
                <td className="px-2 py-2">{dateIN(a.invoice.invoiceDate)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatINR(a.invoice.total)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatINR(a.amount)}</td>
              </tr>
            ))}
            {onAccount > 0 && (
              <tr style={{ borderBottom: `1px solid ${DOC_RULE}` }}>
                <td className="px-2 py-2" colSpan={3}>Held on account, against future bills</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatINR(onAccount)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {receipt.notes && <p className="mt-3 text-[11px]" style={{ color: DOC_MUTED }}>{receipt.notes}</p>}

        <div className="mt-6 flex justify-end [break-inside:avoid]">
          <SignatureBlock company={company} />
        </div>
        <p className="mt-4 text-[10px]" style={{ color: DOC_MUTED }}>
          This receipt is valid subject to realisation of the cheque or transfer.
        </p>
      </div>
    </div>
  );
}
