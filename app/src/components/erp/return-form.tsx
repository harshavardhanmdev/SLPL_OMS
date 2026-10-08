"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/money";
import { deleteReturn, saveReturn } from "@/lib/return-actions";
import { todayLocalIso } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type Line = {
  description: string;
  hsnCode: string;
  unit: string;
  quantity: string;
  mrp: string;
  rate: string;
};
const blankLine: Line = { description: "", hsnCode: "4901", unit: "SET", quantity: "1", mrp: "", rate: "" };

/** What came back, from which school, and anything paid back to them. */
export function ReturnForm({
  organizations,
  invoices,
}: {
  organizations: { id: string; name: string }[];
  invoices: { id: string; organizationId: string; label: string }[];
}) {
  const router = useRouter();
  const [orgId, setOrgId] = React.useState(organizations[0]?.id ?? "");
  const [invoiceId, setInvoiceId] = React.useState("");
  const [returnedOn, setReturnedOn] = React.useState(todayLocalIso());
  const [refunded, setRefunded] = React.useState("0");
  const [reason, setReason] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([{ ...blankLine }]);
  const [busy, setBusy] = React.useState(false);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((old) => old.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const amount = (l: Line) => Math.round((Number(l.rate) || 0) * 100) * (Number(l.quantity) || 0);
  const total = lines.reduce((s, l) => s + amount(l), 0);
  const theirInvoices = invoices.filter((i) => i.organizationId === orgId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveReturn({
        organizationId: orgId,
        invoiceId: invoiceId || null,
        returnedOn,
        refunded: Number(refunded) || 0,
        reason,
        lines: lines.map((l) => ({
          description: l.description,
          hsnCode: l.hsnCode,
          unit: l.unit,
          quantity: Number(l.quantity) || 0,
          mrp: l.mrp ? Number(l.mrp) : null,
          rate: Number(l.rate) || 0,
        })),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Saved as ${res.number}.`);
      router.push(`/erp/returns/${res.id}`);
    } finally {
      setBusy(false);
    }
  }

  const num = (v: string) => v.replace(/[^\d.]/g, "");

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 sm:p-5">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rt-org">School</Label>
          <select
            id="rt-org"
            className={selectClass}
            value={orgId}
            onChange={(e) => {
              setOrgId(e.target.value);
              setInvoiceId("");
            }}
            required
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rt-date">Return date</Label>
          <Input
            id="rt-date"
            type="date"
            value={returnedOn}
            onChange={(e) => setReturnedOn(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rt-invoice">Against which bill</Label>
          <select
            id="rt-invoice"
            className={selectClass}
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          >
            <option value="">Not sure, or several</option>
            {theirInvoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="font-heading font-semibold">What came back</h2>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-12">
            <div className="col-span-2 space-y-1 sm:col-span-12">
              <Label htmlFor={`rt-desc-${i}`} className="text-xs">
                Description
              </Label>
              <Input
                id={`rt-desc-${i}`}
                value={l.description}
                onChange={(e) => setLine(i, { description: e.target.value })}
                placeholder="LKG set"
                className="h-10"
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`rt-hsn-${i}`} className="text-xs">
                HSN
              </Label>
              <Input
                id={`rt-hsn-${i}`}
                value={l.hsnCode}
                onChange={(e) => setLine(i, { hsnCode: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`rt-qty-${i}`} className="text-xs">
                Quantity
              </Label>
              <Input
                id={`rt-qty-${i}`}
                inputMode="numeric"
                value={l.quantity}
                onChange={(e) => setLine(i, { quantity: e.target.value.replace(/\D/g, "") })}
                className="h-10"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`rt-unit-${i}`} className="text-xs">
                Unit
              </Label>
              <Input
                id={`rt-unit-${i}`}
                value={l.unit}
                onChange={(e) => setLine(i, { unit: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`rt-mrp-${i}`} className="text-xs">
                MRP
              </Label>
              <Input
                id={`rt-mrp-${i}`}
                inputMode="decimal"
                value={l.mrp}
                onChange={(e) => setLine(i, { mrp: num(e.target.value) })}
                className="h-10"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`rt-rate-${i}`} className="text-xs">
                Rate
              </Label>
              <Input
                id={`rt-rate-${i}`}
                inputMode="decimal"
                value={l.rate}
                onChange={(e) => setLine(i, { rate: num(e.target.value) })}
                className="h-10"
                required
              />
            </div>
            <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-2">
              <span className="pb-2 text-sm font-semibold tabular-nums">{formatINR(amount(l))}</span>
              {lines.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove line ${i + 1}`}
                  onClick={() => setLines((old) => old.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => setLines((old) => [...old, { ...blankLine }])}
        >
          <Plus className="size-4" /> Add a line
        </Button>
        <p className="text-right font-heading text-lg font-bold tabular-nums">Total {formatINR(total)}</p>
      </section>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 sm:p-5">
        <div className="space-y-1.5">
          <Label htmlFor="rt-refunded">Paid back to the school, rupees</Label>
          <Input
            id="rt-refunded"
            inputMode="decimal"
            value={refunded}
            onChange={(e) => setRefunded(num(e.target.value))}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">Usually 0: the return then comes off what they owe.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rt-reason">Why it came back</Label>
          <Input
            id="rt-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Extra sets after admissions closed"
            className="h-11"
          />
        </div>
      </section>

      <Button type="submit" size="lg" className="gap-2" disabled={busy || !orgId}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
        Record the return
      </Button>
    </form>
  );
}

/** An owner removes a return recorded by mistake. */
export function DeleteReturn({ id, number }: { id: string; number: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="outline"
      className="gap-2"
      disabled={busy}
      onClick={() => {
        if (!window.confirm(`Delete ${number}? The school's balance goes back to what it was.`)) return;
        setBusy(true);
        void deleteReturn(id)
          .then((res) => {
            if (res.error) toast.error(res.error);
            else {
              toast.success(`${number} deleted.`);
              router.push("/erp/returns");
            }
          })
          .finally(() => setBusy(false));
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete
    </Button>
  );
}
