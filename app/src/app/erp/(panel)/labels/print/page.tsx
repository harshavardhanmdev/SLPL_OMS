export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { PrintButton } from "@/components/store/print-button";
import { code128Svg } from "@/lib/barcode";
import { getCompany } from "@/lib/company";
import { printableLabels, type PrintLabel } from "@/lib/parcel-labels";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Parcel labels", robots: { index: false } };

/** 26-Oct-26, as the label in the owner's photo writes it, on India's calendar. */
function labelDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Kolkata",
  }).formatToParts(d);
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${part("day")}-${part("month")}-${part("year")}`;
}

/**
 * The printed sheets: A4 turned sideways, four A6 labels on each, filled in
 * order. A part sheet leaves the remaining quarters blank. Plain black on
 * white, in literal colours, because a printer must not follow dark mode.
 */
export default async function PrintLabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "shipments.manage")) redirect("/erp");
  const { ids: raw } = await searchParams;
  const ids = (raw ?? "").split(",").filter(Boolean).slice(0, 200);

  const [labels, company] = await Promise.all([printableLabels(ids), getCompany()]);
  const sheets: (PrintLabel | null)[][] = [];
  for (let i = 0; i < labels.length; i += 4) {
    const four: (PrintLabel | null)[] = labels.slice(i, i + 4);
    while (four.length < 4) four.push(null);
    sheets.push(four);
  }
  const returnTo = [company.name, company.address, company.phone].filter(Boolean).join(", ");

  return (
    <div>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          .label-sheet { margin: 0 !important; box-shadow: none !important; }
          .label-sheet + .label-sheet { break-before: page; }
        }
      `}</style>

      <div className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/erp/labels"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to parcel labels
        </Link>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {labels.length} {labels.length === 1 ? "label" : "labels"} on {sheets.length} A4{" "}
            {sheets.length === 1 ? "sheet" : "sheets"}. Print at actual size, landscape.
          </p>
          <PrintButton label="Print labels" />
        </div>
      </div>

      {labels.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground print:hidden">
          Nothing to print. Go back and tick some parcels.
        </p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          {sheets.map((four, s) => (
            <div
              key={s}
              className="label-sheet relative mx-auto mb-6 grid grid-cols-2 grid-rows-2 overflow-hidden bg-white text-black shadow-md"
              style={{ width: "297mm", height: "209.5mm" }}
            >
              {/* Cut guides between the quarters */}
              <div
                className="absolute inset-y-0 left-1/2 border-l border-dashed"
                style={{ borderColor: "#b8b8b8" }}
              />
              <div
                className="absolute inset-x-0 top-1/2 border-t border-dashed"
                style={{ borderColor: "#b8b8b8" }}
              />
              {four.map((label, i) => (
                <div key={i} style={{ padding: "5mm" }}>
                  {label && <ParcelLabel label={label} returnTo={returnTo} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ParcelLabel({ label, returnTo }: { label: PrintLabel; returnTo: string }) {
  return (
    <div
      className="flex h-full flex-col overflow-hidden font-sans font-bold uppercase leading-tight"
      style={{ border: "0.5mm solid #000", borderRadius: "3mm", padding: "4.5mm 5.5mm", color: "#000" }}
    >
      <div className="grid items-start gap-[3mm]" style={{ gridTemplateColumns: "38mm 1fr 25mm" }}>
        <div>
          <p style={{ fontSize: "7.5pt", letterSpacing: "0.08em" }}>{label.kind} /</p>
          <p style={{ fontSize: "9.5pt" }} className="break-all">
            {label.reference}
          </p>
        </div>
        <div className="text-center">
          <div style={{ height: "11mm" }} dangerouslySetInnerHTML={{ __html: code128Svg(label.number) }} />
          <p style={{ fontSize: "10.5pt", letterSpacing: "0.06em", marginTop: "1mm" }}>{label.number}</p>
        </div>
        <div className="text-right" style={{ fontSize: "10pt" }}>
          <p>Qty: {label.quantity}</p>
          <p style={{ marginTop: "2mm" }}>{labelDate(label.printedOn)}</p>
        </div>
      </div>

      <p style={{ fontSize: "15pt", marginTop: "4mm" }}>{label.name}</p>
      <div style={{ fontSize: "12pt", marginTop: "3mm" }} className="space-y-[2mm]">
        {label.lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "1fr 1fr 22mm", fontSize: "12pt", marginTop: "4mm", rowGap: "2mm" }}
      >
        <p>{label.city}</p>
        <p style={{ fontSize: "13.5pt" }}>{label.pincode}</p>
        <p className="row-span-3 self-center text-right" style={{ fontSize: "20pt" }}>
          {label.cityCode}
        </p>
        <p>Phone:</p>
        <p>{label.phone}</p>
        <p>Cust-ID:</p>
        <p>{label.customerCode || "-"}</p>
      </div>

      <div className="mt-auto normal-case" style={{ fontWeight: 400, color: "#222" }}>
        <p className="truncate" style={{ fontSize: "7.5pt" }}>
          Contents: {label.contents}
        </p>
        <p style={{ fontSize: "6.5pt", marginTop: "0.8mm" }} className="line-clamp-2">
          If undelivered, please return to {returnTo}
        </p>
      </div>
    </div>
  );
}
