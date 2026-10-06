"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/money";
import { OUR_STATE, documentTotals, lineTotals, ratePercent } from "@/lib/quotation-math";
import { saveInvoice } from "@/lib/invoice-actions";
import type { CatalogItem } from "@/components/erp/quotation-form";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export type OrgOption = {
  id: string;
  name: string;
  code: string;
  placeOfSupply: string;
};

type Row = {
  productId: string | null;
  description: string;
  hsnCode: string;
  unit: string;
  quantity: string;
  mrp: string;
  unitPrice: string;
  discountBp: string;
  gstRate: string;
};

const blankRow: Row = {
  productId: null,
  description: "",
  hsnCode: "",
  unit: "Nos",
  quantity: "1",
  mrp: "",
  unitPrice: "",
  discountBp: "0",
  gstRate: "0",
};

export type InvoiceDraft = {
  id?: string;
  organizationId: string;
  productLine: "MAG" | "BOOK" | "SVC";
  invoiceDate: string;
  dueDays: string;
  placeOfSupply: string;
  billDiscountBp: string;
  terms: string;
  notes: string;
  lines: Row[];
};

const DEFAULT_TERMS = [
  "Refunds and returns are as per signed MOU.",
  "All disputes are subject to Hyderabad jurisdiction only.",
].join("\n");

export function InvoiceForm({
  catalog,
  organizations,
  initial,
}: {
  catalog: CatalogItem[];
  organizations: OrgOption[];
  initial?: InvoiceDraft;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const [v, setV] = React.useState<InvoiceDraft>(
    initial ?? {
      organizationId: organizations[0]?.id ?? "",
      productLine: "BOOK",
      invoiceDate: today,
      dueDays: "15",
      placeOfSupply: organizations[0]?.placeOfSupply ?? OUR_STATE,
      billDiscountBp: "0",
      terms: DEFAULT_TERMS,
      notes: "",
      lines: [{ ...blankRow }],
    },
  );

  const set = <K extends keyof InvoiceDraft>(k: K, value: InvoiceDraft[K]) =>
    setV((old) => ({ ...old, [k]: value }));
  const setRow = (i: number, patch: Partial<Row>) =>
    setV((old) => ({ ...old, lines: old.lines.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  function pickOrg(id: string) {
    const org = organizations.find((o) => o.id === id);
    setV((old) => ({
      ...old,
      organizationId: id,
      placeOfSupply: org?.placeOfSupply || old.placeOfSupply,
    }));
  }

  function pickProduct(i: number, productId: string) {
    const item = catalog.find((c) => c.id === productId);
    if (!item) {
      setRow(i, { productId: null });
      return;
    }
    setRow(i, {
      productId: item.id,
      description: item.title,
      hsnCode: item.hsnCode ?? "",
      unit: item.unit,
      mrp: (item.price / 100).toString(),
      unitPrice: (item.price / 100).toString(),
      gstRate: String(item.gstRate),
    });
  }

  const parsed = v.lines.map((r) => ({
    description: r.description,
    hsnCode: r.hsnCode,
    unit: r.unit,
    quantity: Number(r.quantity) || 0,
    unitPrice: Math.round((Number(r.unitPrice) || 0) * 100),
    discountBp: Number(r.discountBp) || 0,
    gstRate: Number(r.gstRate) || 0,
  }));
  const billDiscountBp = Number(v.billDiscountBp) || 0;
  const totals = documentTotals(parsed, v.placeOfSupply, billDiscountBp);
  const taxed = parsed.some((l) => l.gstRate > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveInvoice({
        id: v.id,
        organizationId: v.organizationId,
        productLine: v.productLine,
        invoiceDate: v.invoiceDate,
        dueDays: Number(v.dueDays) || 15,
        placeOfSupply: v.placeOfSupply,
        billDiscountBp,
        terms: v.terms,
        notes: v.notes,
        lines: v.lines.map((r) => ({
          productId: r.productId,
          description: r.description,
          hsnCode: r.hsnCode,
          unit: r.unit,
          quantity: Number(r.quantity) || 0,
          mrp: r.mrp ? Number(r.mrp) : null,
          unitPrice: Number(r.unitPrice) || 0,
          discountBp: Number(r.discountBp) || 0,
          gstRate: Number(r.gstRate) || 0,
        })),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Saved as ${res.number}.`);
      router.push(`/erp/invoices/${res.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-heading font-semibold">Who and when</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="in-org">School</Label>
            <select
              id="in-org"
              className={selectClass}
              value={v.organizationId}
              onChange={(e) => pickOrg(e.target.value)}
              required
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-line">What is being sold</Label>
            <select
              id="in-line"
              className={selectClass}
              value={v.productLine}
              onChange={(e) => set("productLine", e.target.value as never)}
            >
              <option value="BOOK">Books, number starts BOOK</option>
              <option value="MAG">Magazine, number starts MAG</option>
              <option value="SVC">Services, number starts SVC</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-date">Invoice date</Label>
            <Input
              id="in-date"
              type="date"
              value={v.invoiceDate}
              onChange={(e) => set("invoiceDate", e.target.value)}
              className="h-11"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-due">Payable within, days</Label>
            <Input
              id="in-due"
              inputMode="numeric"
              value={v.dueDays}
              onChange={(e) => set("dueDays", e.target.value.replace(/\D/g, ""))}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-pos">Place of supply</Label>
            <Input
              id="in-pos"
              value={v.placeOfSupply}
              onChange={(e) => set("placeOfSupply", e.target.value)}
              className="h-11"
              required
            />
            <p className="text-xs text-muted-foreground">
              {totals.interState
                ? "Outside Telangana, so IGST applies."
                : "Inside Telangana, so CGST and SGST apply."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-heading font-semibold">What they are buying</h2>
        <div className="space-y-4">
          {v.lines.map((row, i) => {
            const t = lineTotals(parsed[i]);
            return (
              <div key={i} className="rounded-xl border bg-muted/20 p-3">
                <div className="grid gap-2 sm:grid-cols-12">
                  <div className="space-y-1.5 sm:col-span-12">
                    <Label htmlFor={`in-pick-${i}`} className="text-xs">
                      Pick from the catalogue, or type anything
                    </Label>
                    <select
                      id={`in-pick-${i}`}
                      className={selectClass}
                      value={row.productId ?? ""}
                      onChange={(e) => pickProduct(i, e.target.value)}
                    >
                      <option value="">Custom line, typed below</option>
                      {catalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} - {formatINR(c.price)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-4">
                    <Label htmlFor={`in-desc-${i}`} className="text-xs">
                      Description
                    </Label>
                    <Input
                      id={`in-desc-${i}`}
                      value={row.description}
                      onChange={(e) => setRow(i, { description: e.target.value })}
                      className="h-10"
                      required
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor={`in-qty-${i}`} className="text-xs">
                      Qty
                    </Label>
                    <Input
                      id={`in-qty-${i}`}
                      inputMode="numeric"
                      value={row.quantity}
                      onChange={(e) => setRow(i, { quantity: e.target.value.replace(/\D/g, "") })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`in-mrp-${i}`} className="text-xs">
                      MRP
                    </Label>
                    <Input
                      id={`in-mrp-${i}`}
                      inputMode="decimal"
                      value={row.mrp}
                      onChange={(e) => setRow(i, { mrp: e.target.value.replace(/[^\d.]/g, "") })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`in-rate-${i}`} className="text-xs">
                      Rate charged
                    </Label>
                    <Input
                      id={`in-rate-${i}`}
                      inputMode="decimal"
                      value={row.unitPrice}
                      onChange={(e) => setRow(i, { unitPrice: e.target.value.replace(/[^\d.]/g, "") })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label htmlFor={`in-gst-${i}`} className="text-xs">
                      GST
                    </Label>
                    <select
                      id={`in-gst-${i}`}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      value={row.gstRate}
                      onChange={(e) => setRow(i, { gstRate: e.target.value })}
                    >
                      <option value="0">Nil, printed book</option>
                      <option value="500">5%, e-book</option>
                      <option value="1200">12%</option>
                      <option value="1800">18%, service</option>
                    </select>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {formatINR(t.gross)}
                    {row.mrp && Number(row.mrp) > Number(row.unitPrice)
                      ? `, ${formatINR(
                          Math.round((Number(row.mrp) - Number(row.unitPrice)) * 100 * (Number(row.quantity) || 0)),
                        )} off MRP`
                      : ""}
                  </span>
                  {v.lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-destructive"
                      onClick={() => set("lines", v.lines.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-2"
          onClick={() => set("lines", [...v.lines, { ...blankRow }])}
        >
          <Plus className="size-4" /> Add a line
        </Button>
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading font-semibold">Totals</h2>
          <div className="space-y-1.5">
            <Label htmlFor="in-billdisc" className="text-xs">
              Discount on the whole bill, percent
            </Label>
            <Input
              id="in-billdisc"
              inputMode="decimal"
              value={(billDiscountBp / 100).toString()}
              onChange={(e) =>
                set("billDiscountBp", String(Math.round((Number(e.target.value) || 0) * 100)))
              }
              className="h-10 w-28"
            />
          </div>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatINR(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular-nums">- {formatINR(totals.discount)}</dd>
            </div>
          )}
          {taxed && !totals.interState && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">CGST</dt>
                <dd className="tabular-nums">{formatINR(totals.cgst)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">SGST</dt>
                <dd className="tabular-nums">{formatINR(totals.sgst)}</dd>
              </div>
            </>
          )}
          {taxed && totals.interState && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">IGST</dt>
              <dd className="tabular-nums">{formatINR(totals.igst)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 font-heading text-lg font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatINR(totals.total)}</dd>
          </div>
        </dl>
        <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          {taxed
            ? "A line carries GST, so this prints as a TAX INVOICE with the tax columns."
            : "Every line is nil rated, so this prints as a BILL OF SUPPLY with no tax columns."}{" "}
          {totals.byRate.length > 1 && "Mixed rates are taxed separately and shown per rate."}
          {totals.byRate
            .filter((r) => r.rate > 0)
            .map((r) => ` ${ratePercent(r.rate)} on ${formatINR(r.taxable)}.`)
            .join("")}
        </p>
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-heading font-semibold">Terms and notes</h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="in-terms">Terms, one per line</Label>
            <textarea
              id="in-terms"
              value={v.terms}
              onChange={(e) => set("terms", e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent p-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-notes">Private note, not printed</Label>
            <Input
              id="in-notes"
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="h-11"
            />
          </div>
        </div>
      </section>

      <Button type="submit" size="lg" disabled={busy || !v.organizationId} className="gap-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {v.id ? "Save changes" : "Raise the invoice"}
      </Button>
    </form>
  );
}
