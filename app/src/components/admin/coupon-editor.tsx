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
import { deleteCoupon, saveCoupon, type CouponInput } from "@/lib/admin-actions";

export type CouponRow = {
  id: string;
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  isActive: boolean;
};

const empty: CouponRow = {
  id: "",
  code: "",
  type: "PERCENT",
  value: 10,
  minOrder: 0,
  maxDiscount: null,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  isActive: true,
};

export function CouponEditor({ coupon }: { coupon?: CouponRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState<CouponRow>(coupon ?? empty);

  React.useEffect(() => {
    if (open) setV(coupon ?? empty);
  }, [open, coupon]);

  async function submit() {
    setBusy(true);
    try {
      const input: CouponInput = {
        id: v.id || undefined,
        code: v.code,
        type: v.type,
        value: v.type === "FLAT" ? Math.round(v.value * 100) : v.value, // flat entered in ₹
        minOrder: Math.round(v.minOrder * 100),
        maxDiscount: v.maxDiscount != null ? Math.round(v.maxDiscount * 100) : null,
        startsAt: v.startsAt,
        endsAt: v.endsAt,
        usageLimit: v.usageLimit,
        isActive: v.isActive,
      };
      const res = await saveCoupon(input);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Coupon saved");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {coupon ? (
          <Button variant="outline" size="sm">
            Edit
          </Button>
        ) : (
          <Button className="gap-2">
            <Plus className="size-4" /> New coupon
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{coupon ? `Edit ${coupon.code}` : "New coupon"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input
              value={v.code}
              onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
              placeholder="DIWALI25"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={v.type} onValueChange={(t) => setV({ ...v, type: t as CouponRow["type"] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT">Percent off</SelectItem>
                <SelectItem value="FLAT">Flat ₹ off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{v.type === "PERCENT" ? "Percent (1–90)" : "Amount off (₹)"}</Label>
            <Input type="number" min={1} value={v.value} onChange={(e) => setV({ ...v, value: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Minimum order (₹, 0 = none)</Label>
            <Input type="number" min={0} value={v.minOrder} onChange={(e) => setV({ ...v, minOrder: Number(e.target.value) })} />
          </div>
          {v.type === "PERCENT" && (
            <div className="space-y-1.5">
              <Label>Max discount (₹, empty = no cap)</Label>
              <Input
                type="number"
                min={1}
                value={v.maxDiscount ?? ""}
                onChange={(e) => setV({ ...v, maxDiscount: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Usage limit (empty = unlimited)</Label>
            <Input
              type="number"
              min={1}
              value={v.usageLimit ?? ""}
              onChange={(e) => setV({ ...v, usageLimit: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Starts (optional)</Label>
            <Input type="datetime-local" value={v.startsAt ?? ""} onChange={(e) => setV({ ...v, startsAt: e.target.value || null })} />
          </div>
          <div className="space-y-1.5">
            <Label>Ends (optional)</Label>
            <Input type="datetime-local" value={v.endsAt ?? ""} onChange={(e) => setV({ ...v, endsAt: e.target.value || null })} />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
            <Checkbox checked={v.isActive} onCheckedChange={(c) => setV({ ...v, isActive: c === true })} />
            Active
          </label>
        </div>
        <DialogFooter className="gap-2">
          {coupon && (
            <Button
              variant="outline"
              className="gap-1.5 text-destructive"
              disabled={busy}
              onClick={async () => {
                if (!confirm("Delete this coupon?")) return;
                await deleteCoupon(coupon.id);
                setOpen(false);
                router.refresh();
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
          <Button disabled={busy || !v.code || v.value < 1} onClick={submit} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
