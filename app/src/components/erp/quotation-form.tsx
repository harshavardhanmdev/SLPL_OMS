"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/money";
import { OUR_STATE, lineTotals, quoteTotals, ratePercent } from "@/lib/quotation-math";
import { saveQuotation } from "@/lib/quotation-actions";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export type CatalogItem = {
  id: string;
  title: string;
  hsnCode: string | null;
  gstRate: number;
  /** Paise. */
  price: number;
  unit: string;
};

type Row = {
  productId: string | null;
  description: string;
  hsnCode: string;
  unit: string;
  quantity: string;
  /** Rupees as typed. */
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
  unitPrice: "",
  discountBp: "0",
  gstRate: "0",
};

export type QuotationDraft = {
  id?: string;
  customerName: string;
  contactPerson: string;
  phone: string;
  email: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  placeOfSupply: string;
  validDays: string;
  terms: string;
  notes: string;
  lines: Row[];
};

const DEFAULT_TERMS = [
  "Prices are quoted per copy and are valid for the period shown above.",
  "Delivery within 7 to 10 working days of a confirmed order.",
  "Payment: 50% with the order, balance before dispatch.",
  "Printed books are nil rated under HSN 4901. Services attract GST at 18%.",
].join("\n");

export function QuotationForm({
  catalog,
  initial,
}: {
  catalog: CatalogItem[];
  initial?: QuotationDraft;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState<QuotationDraft>(
    initial ?? {
      customerName: "",
      contactPerson: "",
      phone: "",
      email: "",
      addressLine: "",
      city: "",
      state: OUR_STATE,
      pincode: "",
      gstin: "",
      placeOfSupply: OUR_STATE,
      validDays: "30",
      terms: DEFAULT_TERMS,
      notes: "",
      lines: [{ ...blankRow }],
    },
  );

  const set = <K extends keyof QuotationDraft>(k: K, value: QuotationDraft[K]) =>
    setV((old) => ({ ...old, [k]: value }));

  const setRow = (i: number, patch: Partial<Row>) =>
    setV((old) => ({
      ...old,
      lines: old.lines.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));

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
  const totals = quoteTotals(parsed, v.placeOfSupply);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveQuotation({
        id: v.id,
        customerName: v.customerName,
        contactPerson: v.contactPerson,
        phone: v.phone,
        email: v.email,
        addressLine: v.addressLine,
        city: v.city,
        state: v.state,
        pincode: v.pincode,
        gstin: v.gstin,
        placeOfSupply: v.placeOfSupply,
        validDays: Number(v.validDays) || 30,
        terms: v.terms,
        notes: v.notes,
        lines: v.lines.map((r) => ({
          productId: r.productId,
          description: r.description,
          hsnCode: r.hsnCode,
          unit: r.unit,
          quantity: Number(r.quantity) || 0,
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
      router.push(`/erp/quotations/${res.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-heading font-semibold">Who it is for</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="q-name">School or organisation</Label>
            <Input
              id="q-name"
              value={v.customerName}
              onChange={(e) => set("customerName", e.target.value)}
              className="h-11"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-contact">Contact person</Label>
            <Input
              id="q-contact"
              value={v.contactPerson}
              onChange={(e) => set("contactPerson", e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-phone">Phone</Label>
            <Input
              id="q-phone"
              value={v.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-email">Email</Label>
            <Input
              id="q-email"
              value={v.email}
              onChange={(e) => set("email", e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-gstin">Their GSTIN</Label>
            <Input
              id="q-gstin"
              value={v.gstin}
              onChange={(e) => set("gstin", e.target.value.toUpperCase())}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="q-address">Address</Label>
            <Input
              id="q-address"
              value={v.addressLine}
              onChange={(e) => set("addressLine", e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-city">City</Label>
            <Input
              id="q-city"
              value={v.city}
              onChange={(e) => set("city", e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-pincode">Pincode</Label>
            <Input
              id="q-pincode"
              value={v.pincode}
              onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-pos">Place of supply</Label>
            <Input
              id="q-pos"
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
          <div className="space-y-1.5">
            <Label htmlFor="q-valid">Valid for, in days</Label>
            <Input
              id="q-valid"
              inputMode="numeric"
              value={v.validDays}
              onChange={(e) => set("validDays", e.target.value.replace(/\D/g, ""))}
              className="h-11"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-heading font-semibold">What we are quoting</h2>
        <div className="space-y-4">
          {v.lines.map((row, i) => {
            const t = lineTotals(parsed[i]);
            return (
              <div key={i} className="rounded-xl border bg-muted/20 p-3">
                <div className="grid gap-2 sm:grid-cols-12">
                  <div className="space-y-1.5 sm:col-span-12">
                    <Label htmlFor={`q-pick-${i}`} className="text-xs">
                      Pick from the catalogue, or type anything for a service
                    </Label>
                    <select
                      id={`q-pick-${i}`}
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
                  <div className="space-y-1.5 sm:col-span-5">
                    <Label htmlFor={`q-desc-${i}`} className="text-xs">
                      Description
                    </Label>
                    <Input
                      id={`q-desc-${i}`}
                      value={row.description}
                      onChange={(e) => setRow(i, { description: e.target.value })}
                      className="h-10"
                      required
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`q-hsn-${i}`} className="text-xs">
                      HSN or SAC
                    </Label>
                    <Input
                      id={`q-hsn-${i}`}
                      value={row.hsnCode}
                      onChange={(e) => setRow(i, { hsnCode: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor={`q-qty-${i}`} className="text-xs">
                      Qty
                    </Label>
                    <Input
                      id={`q-qty-${i}`}
                      inputMode="numeric"
                      value={row.quantity}
                      onChange={(e) => setRow(i, { quantity: e.target.value.replace(/\D/g, "") })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`q-rate-${i}`} className="text-xs">
                      Rate, rupees
                    </Label>
                    <Input
                      id={`q-rate-${i}`}
                      inputMode="decimal"
                      value={row.unitPrice}
                      onChange={(e) =>
                        setRow(i, { unitPrice: e.target.value.replace(/[^\d.]/g, "") })
                      }
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`q-gst-${i}`} className="text-xs">
                      GST
                    </Label>
                    <select
                      id={`q-gst-${i}`}
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
                    {formatINR(t.taxable)} taxable
                    {t.tax > 0 ? ` plus ${formatINR(t.tax)} GST` : ", nil rated"} ={" "}
                    <b className="text-foreground">{formatINR(t.total)}</b>
                  </span>
                  {v.lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-destructive"
                      onClick={() =>
                        set(
                          "lines",
                          v.lines.filter((_, j) => j !== i),
                        )
                      }
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
        <h2 className="mb-3 font-heading font-semibold">Totals</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Taxable value</dt>
            <dd className="tabular-nums">{formatINR(totals.taxable)}</dd>
          </div>
          {totals.byRate
            .filter((r) => r.rate > 0)
            .map((r) => (
              <div key={r.rate} className="flex justify-between">
                <dt className="text-muted-foreground">
                  GST at {ratePercent(r.rate)} on {formatINR(r.taxable)}
                </dt>
                <dd className="tabular-nums">{formatINR(r.tax)}</dd>
              </div>
            ))}
          {!totals.interState && totals.cgst > 0 && (
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
          {totals.interState && totals.igst > 0 && (
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
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-heading font-semibold">Terms and notes</h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="q-terms">Terms, one per line</Label>
            <textarea
              id="q-terms"
              value={v.terms}
              onChange={(e) => set("terms", e.target.value)}
              rows={5}
              className="w-full rounded-md border border-input bg-transparent p-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-notes">Private note, not printed</Label>
            <Input
              id="q-notes"
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="h-11"
            />
          </div>
        </div>
      </section>

      <Button type="submit" size="lg" disabled={busy} className="gap-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {v.id ? "Save changes" : "Create the quotation"}
      </Button>
    </form>
  );
}
