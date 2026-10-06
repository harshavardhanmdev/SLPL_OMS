"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOVE_KINDS } from "@/lib/stock-moves";
import { recordMovement } from "@/lib/stock-movement-actions";
import { todayLocalIso } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export type LineOption = { label: string; series: string | null; unit: "SET" | "COPY" };

export function MovementForm({ lines }: { lines: LineOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const today = todayLocalIso();

  const [v, setV] = React.useState({
    movedAt: today,
    kind: "INWARD",
    label: lines[0]?.label ?? "",
    quantity: "",
    quantityTelugu: "",
    quantityHindi: "",
    increases: "yes",
    party: "",
    document: "",
    note: "",
  });
  const set = (k: keyof typeof v, value: string) => setV((old) => ({ ...old, [k]: value }));

  const line = lines.find((l) => l.label === v.label);
  // Telugu and Hindi are only held apart on the grade lines that do that
  const hasLanguages = /^Grade [1-5]$/i.test(v.label);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await recordMovement({
        movedAt: v.movedAt,
        kind: v.kind,
        label: v.label,
        series: line?.series ?? "",
        unit: line?.unit ?? "SET",
        quantity: Number(v.quantity),
        increases: v.increases === "yes",
        quantityTelugu: hasLanguages && v.quantityTelugu ? Number(v.quantityTelugu) : null,
        quantityHindi: hasLanguages && v.quantityHindi ? Number(v.quantityHindi) : null,
        party: v.party,
        document: v.document,
        note: v.note,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Recorded as ${res.ref}.`);
      setV((old) => ({ ...old, quantity: "", quantityTelugu: "", quantityHindi: "", note: "" }));
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Record a movement
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="font-heading font-semibold">Record a movement</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mv-kind">What happened</Label>
          <select
            id="mv-kind"
            className={selectClass}
            value={v.kind}
            onChange={(e) => set("kind", e.target.value)}
          >
            {MOVE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mv-date">Date it moved</Label>
          <Input
            id="mv-date"
            type="date"
            max={today}
            value={v.movedAt}
            onChange={(e) => set("movedAt", e.target.value)}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mv-line">Register line</Label>
          <select
            id="mv-line"
            className={selectClass}
            value={v.label}
            onChange={(e) => set("label", e.target.value)}
          >
            {lines.map((l) => (
              <option key={l.label} value={l.label}>
                {l.label}
                {l.series ? ` (${l.series})` : ""} - counted in {l.unit === "SET" ? "sets" : "copies"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mv-qty">
            How many {line?.unit === "COPY" ? "copies" : "sets"}
          </Label>
          <Input
            id="mv-qty"
            inputMode="numeric"
            value={v.quantity}
            onChange={(e) => set("quantity", e.target.value.replace(/\D/g, ""))}
            className="h-11"
            required
          />
        </div>
        {v.kind === "ADJUSTMENT" && (
          <div className="space-y-1.5">
            <Label htmlFor="mv-dir">Direction</Label>
            <select
              id="mv-dir"
              className={selectClass}
              value={v.increases}
              onChange={(e) => set("increases", e.target.value)}
            >
              <option value="yes">Found more than the register said</option>
              <option value="no">Found less than the register said</option>
            </select>
          </div>
        )}
        {hasLanguages && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="mv-tel">Telugu copies, if any</Label>
              <Input
                id="mv-tel"
                inputMode="numeric"
                value={v.quantityTelugu}
                onChange={(e) => set("quantityTelugu", e.target.value.replace(/\D/g, ""))}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mv-hin">Hindi copies, if any</Label>
              <Input
                id="mv-hin"
                inputMode="numeric"
                value={v.quantityHindi}
                onChange={(e) => set("quantityHindi", e.target.value.replace(/\D/g, ""))}
                className="h-11"
              />
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="mv-party">School, printer or customer</Label>
          <Input
            id="mv-party"
            value={v.party}
            onChange={(e) => set("party", e.target.value)}
            className="h-11"
            placeholder="Orchids School"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mv-doc">Challan or invoice number</Label>
          <Input
            id="mv-doc"
            value={v.document}
            onChange={(e) => set("document", e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mv-note">Note</Label>
          <Input
            id="mv-note"
            value={v.note}
            onChange={(e) => set("note", e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Record
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Movements are never edited or deleted. A mistake is reversed by its own line with a reason,
        so a statement already sent to the bank still reconciles.
      </p>
    </form>
  );
}
