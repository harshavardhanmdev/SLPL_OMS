"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/money";
import { savePriceItem } from "@/lib/price-list-actions";
import { ratePercent } from "@/lib/quotation-math";
import { cn } from "@/lib/utils";

export type PriceRow = {
  id: string;
  group: string;
  description: string;
  hsnCode: string | null;
  unit: string;
  /** Paise. */
  mrp: number | null;
  rate: number;
  gstRate: number;
  isActive: boolean;
};

const UNITS = ["PCS", "SET", "NOS", "OTH"];

const cell = "h-9 text-sm";

type Draft = {
  group: string;
  description: string;
  hsnCode: string;
  unit: string;
  mrp: string;
  rate: string;
  gstRate: string;
  isActive: boolean;
};

const toDraft = (r: PriceRow): Draft => ({
  group: r.group,
  description: r.description,
  hsnCode: r.hsnCode ?? "",
  unit: r.unit,
  mrp: r.mrp == null ? "" : String(r.mrp / 100),
  rate: String(r.rate / 100),
  gstRate: String(r.gstRate),
  isActive: r.isActive,
});

async function save(id: string | undefined, d: Draft) {
  return savePriceItem({
    id,
    group: d.group,
    description: d.description,
    hsnCode: d.hsnCode,
    unit: d.unit,
    mrp: d.mrp === "" ? null : Number(d.mrp),
    rate: Number(d.rate) || 0,
    gstRate: Number(d.gstRate) || 0,
    isActive: d.isActive,
  });
}

function Fields({
  d,
  set,
  groups,
  showGroup,
}: {
  d: Draft;
  set: (patch: Partial<Draft>) => void;
  groups: string[];
  showGroup: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-12">
      {showGroup && (
        <div className="space-y-1 sm:col-span-12">
          <Label className="text-xs">Group</Label>
          <Input
            list="price-groups"
            value={d.group}
            onChange={(e) => set({ group: e.target.value })}
            className={cell}
            placeholder="Little Leaps Grade 3"
            required
          />
          <datalist id="price-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
      )}
      <div className="space-y-1 sm:col-span-4">
        <Label className="text-xs">Description</Label>
        <Input value={d.description} onChange={(e) => set({ description: e.target.value })} className={cell} required />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Unit</Label>
        <select
          value={d.unit}
          onChange={(e) => set({ unit: e.target.value })}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">MRP, rupees</Label>
        <Input
          inputMode="decimal"
          value={d.mrp}
          onChange={(e) => set({ mrp: e.target.value.replace(/[^\d.]/g, "") })}
          className={cell}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Our rate</Label>
        <Input
          inputMode="decimal"
          value={d.rate}
          onChange={(e) => set({ rate: e.target.value.replace(/[^\d.]/g, "") })}
          className={cell}
          required
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">GST</Label>
        <select
          value={d.gstRate}
          onChange={(e) =>
            set({ gstRate: e.target.value, hsnCode: e.target.value === "1800" ? "9992" : "4901" })
          }
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="0">Nil, book</option>
          <option value="500">5%</option>
          <option value="1800">18%, service</option>
        </select>
      </div>
    </div>
  );
}

/** One line of the price list, editable in place by an owner. */
export function PriceLine({ row, canEdit, groups }: { row: PriceRow; canEdit: boolean; groups: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [d, setD] = React.useState<Draft>(() => toDraft(row));

  if (editing) {
    return (
      <li className="bg-muted/30 p-3 motion-safe:animate-in motion-safe:fade-in-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void save(row.id, d)
              .then((res) => {
                if (res.error) toast.error(res.error);
                else {
                  toast.success("Saved.");
                  setEditing(false);
                  router.refresh();
                }
              })
              .finally(() => setBusy(false));
          }}
          className="space-y-2"
        >
          <Fields d={d} set={(p) => setD((o) => ({ ...o, ...p }))} groups={groups} showGroup />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="size-3.5" /> Cancel
            </Button>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.isActive}
                onChange={(e) => setD((o) => ({ ...o, isActive: e.target.checked }))}
              />
              Offered on quotations
            </label>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm sm:grid-cols-[1fr_4rem_6rem_6rem_4rem_2.5rem]",
        !row.isActive && "opacity-50",
      )}
    >
      <span className="min-w-0">
        <span className="font-medium">{row.description}</span>
        {!row.isActive && <span className="ml-2 text-xs text-muted-foreground">retired</span>}
      </span>
      <span className="hidden text-muted-foreground sm:block">{row.unit}</span>
      <span className="hidden text-right tabular-nums text-muted-foreground sm:block">
        {row.mrp == null ? "-" : formatINR(row.mrp)}
      </span>
      <span className="text-right font-semibold tabular-nums">{formatINR(row.rate)}</span>
      <span className="hidden text-right text-muted-foreground sm:block">
        {row.gstRate === 0 ? "Nil" : ratePercent(row.gstRate)}
      </span>
      <span className="hidden justify-end sm:flex">
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={`Edit ${row.description}`}
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </span>
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="col-span-2 justify-self-start text-xs text-muted-foreground underline sm:hidden"
        >
          Edit
        </button>
      )}
    </li>
  );
}

/** A new line, in a group that exists or a new one. */
export function AddPriceItem({ groups }: { groups: string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const blank: Draft = {
    group: groups[0] ?? "",
    description: "",
    hsnCode: "4901",
    unit: "PCS",
    mrp: "",
    rate: "",
    gstRate: "0",
    isActive: true,
  };
  const [d, setD] = React.useState<Draft>(blank);

  if (!open) {
    return (
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add to the price list
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void save(undefined, d)
          .then((res) => {
            if (res.error) toast.error(res.error);
            else {
              toast.success("Added.");
              setD({ ...blank, group: d.group });
              router.refresh();
            }
          })
          .finally(() => setBusy(false));
      }}
      className="space-y-3 rounded-2xl border bg-card p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
    >
      <h2 className="font-heading font-semibold">New price</h2>
      <Fields d={d} set={(p) => setD((o) => ({ ...o, ...p }))} groups={groups} showGroup />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Add
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>
    </form>
  );
}
