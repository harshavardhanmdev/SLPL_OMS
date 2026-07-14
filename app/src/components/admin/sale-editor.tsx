"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteSaleEvent, saveSaleEvent } from "@/lib/admin-actions";

export type SaleRow = {
  id: string;
  name: string;
  bannerText: string;
  discountType: "PERCENT" | "FLAT";
  value: number; // percent, or ₹ for display
  categoryIds: string[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

type Category = { id: string; name: string };

const empty: SaleRow = {
  id: "",
  name: "",
  bannerText: "",
  discountType: "PERCENT",
  value: 10,
  categoryIds: [],
  startsAt: "",
  endsAt: "",
  isActive: true,
};

export function SaleEditor({ sale, categories }: { sale?: SaleRow; categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState<SaleRow>(sale ?? empty);

  React.useEffect(() => {
    if (open) setV(sale ?? empty);
  }, [open, sale]);

  async function submit() {
    setBusy(true);
    try {
      const res = await saveSaleEvent({
        id: v.id || undefined,
        name: v.name,
        bannerText: v.bannerText,
        discountType: v.discountType,
        value: v.discountType === "FLAT" ? Math.round(v.value * 100) : v.value,
        categoryIds: v.categoryIds,
        startsAt: v.startsAt,
        endsAt: v.endsAt,
        isActive: v.isActive,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Sale saved");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {sale ? (
          <Button variant="outline" size="sm">
            Edit
          </Button>
        ) : (
          <Button className="gap-2">
            <Plus className="size-4" /> New festival sale
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sale ? `Edit ${sale.name}` : "New festival sale"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name (internal)</Label>
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Diwali Sale 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Banner text (shown on the home page)</Label>
            <Input
              value={v.bannerText}
              onChange={(e) => setV({ ...v, bannerText: e.target.value })}
              placeholder="🪔 Diwali Sale — 15% off all textbooks till Nov 2!"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Discount type</Label>
              <Select value={v.discountType} onValueChange={(t) => setV({ ...v, discountType: t as SaleRow["discountType"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percent off</SelectItem>
                  <SelectItem value="FLAT">Flat ₹ off each item</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{v.discountType === "PERCENT" ? "Percent (1–90)" : "₹ off"}</Label>
              <Input type="number" min={1} value={v.value} onChange={(e) => setV({ ...v, value: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <Input type="datetime-local" value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <Input type="datetime-local" value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Applies to (none selected = whole store)</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = v.categoryIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setV({
                        ...v,
                        categoryIds: on ? v.categoryIds.filter((x) => x !== c.id) : [...v.categoryIds, c.id],
                      })
                    }
                    className={
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                      (on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary")
                    }
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={v.isActive} onCheckedChange={(c) => setV({ ...v, isActive: c === true })} />
            Active (auto-runs only between the dates)
          </label>
        </div>
        <DialogFooter className="gap-2">
          {sale && (
            <Button
              variant="outline"
              className="gap-1.5 text-destructive"
              disabled={busy}
              onClick={async () => {
                if (!confirm("Delete this sale?")) return;
                await deleteSaleEvent(sale.id);
                setOpen(false);
                router.refresh();
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
          <Button disabled={busy || !v.name || !v.bannerText || !v.startsAt || !v.endsAt} onClick={submit} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
