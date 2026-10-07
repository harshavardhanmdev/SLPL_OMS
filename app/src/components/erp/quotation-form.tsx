"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinePicker, UNITS, type CatalogItem, type OrgOption } from "@/components/erp/line-picker";
import { formatINR } from "@/lib/money";
import {
  BOOK_HSN,
  OUR_STATE,
  documentTotals,
  hsnForRate,
  lineTotals,
  ratePercent,
} from "@/lib/quotation-math";
import { saveQuotation } from "@/lib/quotation-actions";
import { cn, todayLocalIso } from "@/lib/utils";

export type { CatalogItem } from "@/components/erp/line-picker";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export type QuoteRow = {
  productId: string | null;
  description: string;
  /** What a set holds, printed under the line. */
  contents: string;
  hsnCode: string;
  unit: string;
  quantity: string;
  mrp: string;
  /** Rupees as typed. */
  unitPrice: string;
  /** Rupees off the line, or a percentage, as chosen. */
  discount: string;
  discountMode: "amount" | "percent";
  gstRate: string;
};

const blankRow: QuoteRow = {
  productId: null,
  description: "",
  contents: "",
  hsnCode: BOOK_HSN,
  unit: "PCS",
  quantity: "1",
  mrp: "",
  unitPrice: "",
  discount: "",
  discountMode: "amount",
  gstRate: "0",
};

export type QuotationDraft = {
  id?: string;
  organizationId: string;
  contactPerson: string;
  shipElsewhere: boolean;
  shipToName: string;
  shipToAddress: string;
  placeOfSupply: string;
  quotedOn: string;
  validDays: string;
  /** Basis points off the whole quotation, as text. */
  billDiscountBp?: string;
  terms: string;
  notes: string;
  lines: QuoteRow[];
};

const DEFAULT_TERMS = [
  "Prices are valid until the expiry date shown above.",
  "Delivery within 7 to 10 working days of a confirmed order.",
  "Payment: 50% with the order, balance before dispatch.",
  "Printed books are nil rated under HSN 4901. Services attract GST at 18%.",
].join("\n");

/**
 * The owner's note for magazine design work, added to the terms the first time
 * a magazine line from the "Designing service" price list group is picked.
 * Curriculum design sits in the same group but is priced per page, so it
 * gets no note.
 */
const DESIGN_GROUP = "Designing service";
const DESIGN_NOTE =
  "The designing and printing price is for a standard 64 page magazine and may vary if the number of pages increases or decreases.";

/** What the server and the totals both read a row as. */
function toLine(r: QuoteRow) {
  const discount = Number(r.discount) || 0;
  return {
    description: r.description,
    hsnCode: r.hsnCode,
    unit: r.unit,
    quantity: Number(r.quantity) || 0,
    unitPrice: Math.round((Number(r.unitPrice) || 0) * 100),
    discountBp: r.discountMode === "percent" ? Math.round(discount * 100) : 0,
    discountAmount: r.discountMode === "amount" ? Math.round(discount * 100) : 0,
    gstRate: Number(r.gstRate) || 0,
  };
}

function expiryLabel(quotedOn: string, days: string): string {
  const d = new Date(quotedOn);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + (Number(days) || 0));
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function QuotationForm({
  catalog,
  organizations,
  initial,
}: {
  catalog: CatalogItem[];
  organizations: OrgOption[];
  initial?: QuotationDraft;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState<QuotationDraft>(
    () =>
      initial ?? {
        organizationId: organizations[0]?.id ?? "",
        contactPerson: "",
        shipElsewhere: false,
        shipToName: "",
        shipToAddress: "",
        placeOfSupply: organizations[0]?.placeOfSupply ?? OUR_STATE,
        quotedOn: todayLocalIso(),
        validDays: "30",
        terms: DEFAULT_TERMS,
        notes: "",
        lines: [{ ...blankRow }],
      },
  );

  const set = <K extends keyof QuotationDraft>(k: K, value: QuotationDraft[K]) =>
    setV((old) => ({ ...old, [k]: value }));
  const setRow = (i: number, patch: Partial<QuoteRow>) =>
    setV((old) => ({ ...old, lines: old.lines.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  function pickOrg(id: string) {
    const org = organizations.find((o) => o.id === id);
    setV((old) => ({ ...old, organizationId: id, placeOfSupply: org?.placeOfSupply || old.placeOfSupply }));
  }

  function pick(i: number, item: CatalogItem | null) {
    if (!item) {
      setRow(i, { productId: null });
      return;
    }
    setRow(i, {
      productId: item.id,
      description: item.title,
      contents: item.contents ?? "",
      hsnCode: item.hsnCode ?? "",
      unit: item.unit,
      mrp: item.mrp ? String(item.mrp / 100) : "",
      unitPrice: String(item.price / 100),
      gstRate: String(item.gstRate),
    });
    if (item.group === DESIGN_GROUP && /magazine/i.test(item.title)) {
      setV((old) =>
        old.terms.includes(DESIGN_NOTE)
          ? old
          : { ...old, terms: old.terms.trim() ? `${old.terms.trim()}\n${DESIGN_NOTE}` : DESIGN_NOTE },
      );
    }
  }

  const parsed = v.lines.map(toLine);
  const billDiscountBp = Number(v.billDiscountBp) || 0;
  // Kept as typed, so "12." survives on the way to "12.5"
  const [discountText, setDiscountText] = React.useState((billDiscountBp / 100).toString());
  const totals = documentTotals(parsed, v.placeOfSupply, billDiscountBp);
  const qty = parsed.reduce((s, l) => s + l.quantity, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveQuotation({
        id: v.id,
        organizationId: v.organizationId,
        contactPerson: v.contactPerson,
        shipToName: v.shipElsewhere ? v.shipToName : "",
        shipToAddress: v.shipElsewhere ? v.shipToAddress : "",
        placeOfSupply: v.placeOfSupply,
        quotedOn: v.quotedOn,
        validDays: Number(v.validDays) || 30,
        billDiscountBp,
        terms: v.terms,
        notes: v.notes,
        lines: v.lines.map((r) => {
          const l = toLine(r);
          return {
            productId: r.productId,
            description: l.description,
            contents: r.contents,
            hsnCode: l.hsnCode,
            unit: l.unit,
            quantity: l.quantity,
            mrp: r.mrp ? Number(r.mrp) : null,
            unitPrice: Number(r.unitPrice) || 0,
            discountBp: l.discountBp,
            discountAmount: l.discountAmount / 100,
            gstRate: l.gstRate,
          };
        }),
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
            <Label htmlFor="q-org">School</Label>
            <select
              id="q-org"
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
            <p className="text-xs text-muted-foreground">
              The bill-to address comes from the school&apos;s record.{" "}
              <Link href="/erp/organizations/new" className="underline">
                Add a new school
              </Link>{" "}
              if it is not listed.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-contact">Kind attention</Label>
            <Input
              id="q-contact"
              value={v.contactPerson}
              onChange={(e) => set("contactPerson", e.target.value)}
              className="h-11"
              placeholder="Leave blank for the school's contact"
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
            <Label htmlFor="q-date">Quotation date</Label>
            <Input
              id="q-date"
              type="date"
              value={v.quotedOn}
              onChange={(e) => set("quotedOn", e.target.value)}
              className="h-11"
              required
            />
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
            <p className="text-xs text-muted-foreground">
              Expires {expiryLabel(v.quotedOn, v.validDays)}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={v.shipElsewhere}
              onChange={(e) => set("shipElsewhere", e.target.checked)}
              className="size-4"
            />
            Ship to a different address than the bill-to
          </label>
          {v.shipElsewhere && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="q-shipname">Ship to</Label>
                <Input
                  id="q-shipname"
                  value={v.shipToName}
                  onChange={(e) => set("shipToName", e.target.value)}
                  className="h-11"
                  placeholder="Branch or campus name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-shipaddr">Ship-to address</Label>
                <Input
                  id="q-shipaddr"
                  value={v.shipToAddress}
                  onChange={(e) => set("shipToAddress", e.target.value)}
                  className="h-11"
                />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-1 font-heading font-semibold">Items and services</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          The school price list comes first in the picker. A line at 0 lists something included
          in a bundle, as the radio quotation does.
        </p>
        <div className="space-y-4">
          {v.lines.map((row, i) => {
            const t = lineTotals(parsed[i]);
            return (
              <div key={i} className="rounded-xl border bg-muted/20 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <div className="space-y-1.5 sm:col-span-12">
                    <Label htmlFor={`q-pick-${i}`} className="text-xs">
                      Pick from the price list, or type anything
                    </Label>
                    <LinePicker
                      id={`q-pick-${i}`}
                      catalog={catalog}
                      value={row.productId}
                      onPick={(item) => pick(i, item)}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-6">
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
                    {row.contents && (
                      <Input
                        aria-label={`In the set, line ${i + 1}`}
                        value={row.contents}
                        onChange={(e) => setRow(i, { contents: e.target.value })}
                        className="h-9 text-xs text-muted-foreground"
                      />
                    )}
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
                  <div className="space-y-1.5 sm:col-span-2">
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
                    <Label htmlFor={`q-unit-${i}`} className="text-xs">
                      Unit
                    </Label>
                    <select
                      id={`q-unit-${i}`}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      value={row.unit}
                      onChange={(e) => setRow(i, { unit: e.target.value })}
                    >
                      {[...new Set([...UNITS, row.unit])].map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label htmlFor={`q-rate-${i}`} className="text-xs">
                      Rate, rupees
                    </Label>
                    <Input
                      id={`q-rate-${i}`}
                      inputMode="decimal"
                      value={row.unitPrice}
                      onChange={(e) => setRow(i, { unitPrice: e.target.value.replace(/[^\d.]/g, "") })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-5">
                    <Label htmlFor={`q-disc-${i}`} className="text-xs">
                      Discount
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        id={`q-disc-${i}`}
                        inputMode="decimal"
                        value={row.discount}
                        onChange={(e) => setRow(i, { discount: e.target.value.replace(/[^\d.]/g, "") })}
                        className="h-10"
                        placeholder="0"
                      />
                      <div className="flex shrink-0 overflow-hidden rounded-md border text-sm">
                        {(["amount", "percent"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setRow(i, { discountMode: m })}
                            className={cn(
                              "px-3 transition-colors",
                              row.discountMode === m ? "bg-navy text-white" : "hover:bg-muted",
                            )}
                            aria-pressed={row.discountMode === m}
                          >
                            {m === "amount" ? "Rs" : "%"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-4">
                    <Label htmlFor={`q-gst-${i}`} className="text-xs">
                      GST
                    </Label>
                    <select
                      id={`q-gst-${i}`}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      value={row.gstRate}
                      onChange={(e) =>
                        setRow(i, {
                          gstRate: e.target.value,
                          hsnCode: hsnForRate(row.hsnCode, Number(e.target.value)),
                        })
                      }
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
                    {t.discount > 0 &&
                      ` less ${formatINR(t.discount)} (${ratePercent(Math.round((t.discount / Math.max(1, t.gross)) * 10000))})`}
                    {t.tax > 0 ? ` plus ${formatINR(t.tax)} GST` : ""} ={" "}
                    <b className="text-foreground">{formatINR(t.total)}</b>
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
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => set("lines", [...v.lines, { ...blankRow }])}
          >
            <Plus className="size-4" /> Add a line
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() =>
              set("lines", [...v.lines, { ...blankRow, unitPrice: "0", gstRate: v.lines[0]?.gstRate ?? "0" }])
            }
          >
            <Plus className="size-4" /> Add an included item at 0
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading font-semibold">Totals</h2>
          <div className="space-y-1.5">
            <Label htmlFor="q-billdisc" className="text-xs">
              Overall discount, percent
            </Label>
            <Input
              id="q-billdisc"
              inputMode="decimal"
              value={discountText}
              onChange={(e) => {
                const text = e.target.value.replace(/[^\d.]/g, "");
                setDiscountText(text);
                set("billDiscountBp", String(Math.round((Number(text) || 0) * 100)));
              }}
              className="h-10 w-28"
            />
          </div>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{qty} items, before discount</dt>
            <dd className="tabular-nums">{formatINR(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Discount{billDiscountBp > 0 ? `, including ${ratePercent(billDiscountBp)} overall` : ""}
              </dt>
              <dd className="tabular-nums">- {formatINR(totals.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Taxable amount</dt>
            <dd className="tabular-nums">{formatINR(totals.taxable)}</dd>
          </div>
          {totals.byRate
            .filter((r) => r.rate > 0)
            .map((r) =>
              totals.interState ? (
                <div key={r.rate} className="flex justify-between">
                  <dt className="text-muted-foreground">IGST @{ratePercent(r.rate)}</dt>
                  <dd className="tabular-nums">{formatINR(r.tax)}</dd>
                </div>
              ) : (
                <React.Fragment key={r.rate}>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">CGST @{ratePercent(r.rate / 2)}</dt>
                    <dd className="tabular-nums">{formatINR(r.cgst)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">SGST @{ratePercent(r.rate / 2)}</dt>
                    <dd className="tabular-nums">{formatINR(r.sgst)}</dd>
                  </div>
                </React.Fragment>
              ),
            )}
          {totals.roundOff !== 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Round off</dt>
              <dd className="tabular-nums">
                {totals.roundOff > 0 ? "+ " : "- "}
                {formatINR(Math.abs(totals.roundOff))}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 font-heading text-lg font-bold">
            <dt>Total amount</dt>
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

      <Button type="submit" size="lg" disabled={busy || !v.organizationId} className="gap-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {v.id ? "Save changes" : "Create the quotation"}
      </Button>
    </form>
  );
}
