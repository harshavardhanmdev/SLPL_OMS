"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveChallan } from "@/lib/challan-actions";

const selectClass =
  "flex h-12 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60";

/** Today in India, computed outside render, whatever zone the device is in. */
function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export type ChallanOrg = { id: string; name: string; address: string };

export type ChallanLine = { description: string; unit: string; quantity: string };

export type ChallanDraft = {
  organizationId: string;
  invoiceId: string;
  invoiceNumber: string;
  fromAddress: string;
  toName: string;
  toAddress: string;
  lines: ChallanLine[];
};

const blankLine: ChallanLine = { description: "", unit: "Nos", quantity: "1" };

/**
 * What is going out, to whom. No prices anywhere, because the challan travels
 * with the goods and the driver has no business knowing what the school paid.
 */
export function ChallanForm({
  organizations,
  draft,
}: {
  organizations: ChallanOrg[];
  draft: ChallanDraft;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState(() => ({
    ...draft,
    lines: draft.lines.length ? draft.lines : [{ ...blankLine }],
    dispatchedOn: todayInIndia(),
    transporter: "",
    vehicleNumber: "",
    notes: "",
  }));
  type Field = Exclude<keyof typeof v, "lines">;
  const set = (k: Field, value: string) => setV((old) => ({ ...old, [k]: value }));
  const setLine = (i: number, patch: Partial<ChallanLine>) =>
    setV((old) => ({ ...old, lines: old.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const totalQty = v.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

  function pickOrg(id: string) {
    const org = organizations.find((o) => o.id === id);
    // Picking a school fills in where the books are going; both stay editable
    setV((old) => ({
      ...old,
      organizationId: id,
      ...(org ? { toName: org.name, toAddress: org.address } : {}),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveChallan({
        organizationId: v.organizationId,
        invoiceId: v.invoiceId,
        dispatchedOn: v.dispatchedOn,
        fromAddress: v.fromAddress,
        toName: v.toName,
        toAddress: v.toAddress,
        transporter: v.transporter,
        vehicleNumber: v.vehicleNumber,
        notes: v.notes,
        lines: v.lines.map((l) => ({
          description: l.description,
          unit: l.unit,
          quantity: Number(l.quantity) || 0,
        })),
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Challan ${res.number} raised.`);
        router.push(`/erp/challans/${res.id}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {v.invoiceNumber && (
        <p className="rounded-xl border border-saffron/40 bg-saffron/10 p-3 text-sm">
          Against invoice <span className="font-mono">{v.invoiceNumber}</span>. The school, address
          and lines are copied from the bill; change anything that is not going out today.
        </p>
      )}

      <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dc-org" className="text-base">
              School
            </Label>
            <select
              id="dc-org"
              className={selectClass}
              value={v.organizationId}
              onChange={(e) => pickOrg(e.target.value)}
              disabled={Boolean(v.invoiceId)}
            >
              <option value="">Not linked to a school</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dc-date" className="text-base">
              Dispatched on
            </Label>
            <Input
              id="dc-date"
              type="date"
              value={v.dispatchedOn}
              onChange={(e) => set("dispatchedOn", e.target.value)}
              className="h-12 text-base"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dc-from" className="text-base">
              From
            </Label>
            <Textarea
              id="dc-from"
              value={v.fromAddress}
              onChange={(e) => set("fromAddress", e.target.value)}
              rows={4}
              className="text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dc-toname" className="text-base">
              To
            </Label>
            <Input
              id="dc-toname"
              value={v.toName}
              onChange={(e) => set("toName", e.target.value)}
              className="h-12 text-base"
              placeholder="School or person receiving the goods"
              required
            />
            <Textarea
              id="dc-toaddress"
              aria-label="Delivery address"
              value={v.toAddress}
              onChange={(e) => set("toAddress", e.target.value)}
              rows={3}
              className="text-base"
              placeholder="Delivery address, with a phone number for the driver"
              required
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="font-heading font-semibold">What is going out</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Once raised these lines are fixed, so check them against what is packed.
        </p>
        <div className="space-y-3">
          {v.lines.map((line, i) => (
            <div key={i} className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-12">
              <div className="space-y-1.5 sm:col-span-7">
                <Label htmlFor={`dc-desc-${i}`} className="text-xs">
                  Description
                </Label>
                <Input
                  id={`dc-desc-${i}`}
                  value={line.description}
                  onChange={(e) => setLine(i, { description: e.target.value })}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`dc-unit-${i}`} className="text-xs">
                  Unit
                </Label>
                <Input
                  id={`dc-unit-${i}`}
                  value={line.unit}
                  onChange={(e) => setLine(i, { unit: e.target.value })}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`dc-qty-${i}`} className="text-xs">
                  Quantity
                </Label>
                <Input
                  id={`dc-qty-${i}`}
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(e) => setLine(i, { quantity: e.target.value.replace(/\D/g, "") })}
                  className="h-11"
                  required
                />
              </div>
              <div className="flex items-end sm:col-span-1">
                {v.lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-11 text-destructive"
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() => setV((old) => ({ ...old, lines: old.lines.filter((_, j) => j !== i) }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setV((old) => ({ ...old, lines: [...old.lines, { ...blankLine }] }))}
          >
            <Plus className="size-4" /> Add a line
          </Button>
          <span className="text-sm text-muted-foreground">Total quantity {totalQty}</span>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
        <div>
          <h2 className="font-heading font-semibold">Transport</h2>
          <p className="text-sm text-muted-foreground">
            Leave these blank if the vehicle is not known yet. You can fill them in later, or the
            driver can write them on the printed copy.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dc-transporter" className="text-base">
              Transporter
            </Label>
            <Input
              id="dc-transporter"
              value={v.transporter}
              onChange={(e) => set("transporter", e.target.value)}
              className="h-12 text-base"
              placeholder="Courier, lorry service, or our own van"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dc-vehicle" className="text-base">
              Vehicle number
            </Label>
            <Input
              id="dc-vehicle"
              value={v.vehicleNumber}
              onChange={(e) => set("vehicleNumber", e.target.value)}
              className="h-12 text-base uppercase"
              placeholder="TS 09 AB 1234"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dc-notes" className="text-base">
            Notes
          </Label>
          <Textarea
            id="dc-notes"
            value={v.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            className="text-base"
            placeholder="Number of cartons, deliver to the school office"
          />
        </div>
      </section>

      <Button type="submit" size="lg" disabled={busy} className="w-full gap-2 sm:w-auto">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Raise the challan
      </Button>
    </form>
  );
}
