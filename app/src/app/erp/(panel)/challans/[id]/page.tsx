export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ChallanTransport } from "@/components/erp/challan-transport";
import {
  DOC_BLUE,
  DOC_MUTED,
  DOC_NAVY,
  DOC_RULE,
  Letterhead,
  SignatureBlock,
} from "@/components/erp/letterhead";
import { PrintButton } from "@/components/store/print-button";
import { getCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Delivery challan", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** A filled-in value, or a ruled blank the driver can write on. */
function Filled({ value }: { value: string | null }) {
  return value ? (
    <span className="font-semibold">{value}</span>
  ) : (
    <span
      className="inline-block min-w-40 flex-1 border-b"
      style={{ borderColor: DOC_NAVY, height: "1.1em" }}
    />
  );
}

/**
 * The challan as it travels with the goods.
 *
 * No prices on it anywhere: the van driver and the school's gatekeeper need
 * to know what is in the cartons, not what it cost.
 */
export default async function ChallanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");

  const challan = await db.deliveryChallan.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      invoice: { select: { id: true, number: true } },
    },
  });
  if (!challan) notFound();

  const company = await getCompany();
  const qty = challan.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <style>{"@media print { @page { size: A4; margin: 10mm; } }"}</style>

      <div className="mb-4 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/erp/challans"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Back to challans
          </Link>
          <PrintButton label="Print the challan" />
        </div>
        {roleCan(staff.role, "challan.write") && (
          <ChallanTransport
            id={challan.id}
            transporter={challan.transporter ?? ""}
            vehicleNumber={challan.vehicleNumber ?? ""}
          />
        )}
      </div>

      <div className="bg-white p-7 text-black" style={{ color: DOC_NAVY }}>
        <Letterhead company={company} docLabel="DELIVERY CHALLAN" />

        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs font-bold"
          style={{ backgroundColor: "#eef2f7" }}
        >
          <span>Challan No.: {challan.number}</span>
          <span>Date: {dateIN(challan.dispatchedOn)}</span>
          {challan.invoice && <span>Invoice No.: {challan.invoice.number}</span>}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-6 text-[11px]">
          <div>
            <p className="font-bold uppercase">From</p>
            <p className="text-sm font-bold">{company.name}</p>
            <p className="whitespace-pre-line">{challan.fromAddress}</p>
          </div>
          <div>
            <p className="font-bold uppercase">To</p>
            <p className="text-sm font-bold">{challan.toName}</p>
            <p className="whitespace-pre-line">{challan.toAddress}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-6 text-[11px]">
          <p className="flex items-end gap-2">
            <span style={{ color: DOC_MUTED }}>Transporter:</span>
            <Filled value={challan.transporter} />
          </p>
          <p className="flex items-end gap-2">
            <span style={{ color: DOC_MUTED }}>Vehicle No.:</span>
            <Filled value={challan.vehicleNumber} />
          </p>
        </div>

        <table className="mt-4 w-full border-collapse text-[11px]">
          <thead>
            <tr style={{ borderBottom: `2px solid ${DOC_BLUE}` }}>
              <th className="w-10 px-2 py-2 text-left font-semibold">#</th>
              <th className="px-2 py-2 text-left font-semibold uppercase">Description</th>
              <th className="px-2 py-2 text-left font-semibold">Unit</th>
              <th className="px-2 py-2 text-right font-semibold">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {challan.items.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: `1px solid ${DOC_RULE}` }}>
                <td className="px-2 py-2 tabular-nums">{i + 1}</td>
                <td className="px-2 py-2 uppercase">{item.description}</td>
                <td className="px-2 py-2">{item.unit}</td>
                <td className="px-2 py-2 text-right tabular-nums">{item.quantity}</td>
              </tr>
            ))}
            <tr style={{ borderTop: `2px solid ${DOC_BLUE}`, borderBottom: `2px solid ${DOC_BLUE}` }}>
              <td className="px-2 py-2 font-bold uppercase" colSpan={3}>
                Total quantity
              </td>
              <td className="px-2 py-2 text-right font-bold tabular-nums">{qty}</td>
            </tr>
          </tbody>
        </table>

        {challan.notes && (
          <p className="mt-3 whitespace-pre-line text-[11px]">
            <span className="font-bold">Notes: </span>
            {challan.notes}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <p className="text-[11px] font-semibold">Received the above goods in good condition.</p>
          <SignatureBlock company={company} />
        </div>

        <p
          className="mt-6 border-t pt-2 text-[10px] leading-snug"
          style={{ borderColor: DOC_RULE, color: DOC_MUTED }}
        >
          This is a delivery challan, not an e-way bill. Goods worth more than Rs 50,000 moving by
          road need an e-way bill raised on the NIC portal, ewaybillgst.gov.in.
        </p>
      </div>
    </div>
  );
}
