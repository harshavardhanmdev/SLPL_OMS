"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Plus, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveExpense } from "@/lib/expense-actions";
import { EXPENSE_CATEGORIES, PAID_FROM } from "@/lib/expense-constants";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const today = () => new Date().toISOString().slice(0, 10);

const blank = {
  spentAt: today(),
  amount: "",
  category: "FUEL",
  paidFrom: "CURRENT_ACCOUNT",
  payee: "",
  note: "",
  reference: "",
  gstAmount: "",
  vendorGstin: "",
};

/**
 * One thumb-sized form. Amount first because that is what the director came to
 * type, the camera right next to it because the bill is in their other hand.
 */
export function ExpenseForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState(blank);
  const [billImage, setBillImage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof blank, value: string) => setV((old) => ({ ...old, [k]: value }));

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      // "receipt" keeps the bill admin-only: bills carry addresses and GSTINs
      form.set("kind", "receipt");
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Could not upload that photo.");
        return;
      }
      setBillImage(data.url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveExpense({
        spentAt: v.spentAt,
        amount: Number(v.amount),
        category: v.category,
        paidFrom: v.paidFrom,
        payee: v.payee,
        note: v.note,
        reference: v.reference,
        billImage,
        gstAmount: v.gstAmount ? Number(v.gstAmount) : null,
        vendorGstin: v.vendorGstin,
      });
      if (res.error) {
        toast.error(res.error === "UNAUTHORIZED" ? "Session expired, log in again." : res.error);
        return;
      }
      toast.success(`Logged as ${res.voucherNo}`);
      setV({ ...blank, spentAt: v.spentAt, paidFrom: v.paidFrom });
      setBillImage(null);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="lg" className="w-full gap-2 text-base sm:w-auto" onClick={() => setOpen(true)}>
        <Plus className="size-5" /> Log an expense
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">New expense</h2>
        <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
          <X className="size-5" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ex-amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                ₹
              </span>
              <Input
                id="ex-amount"
                value={v.amount}
                onChange={(e) => set("amount", e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="450"
                required
                className="h-14 pl-8 font-heading text-2xl font-bold"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Bill photo</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            {billImage ? (
              <div className="flex items-center gap-2">
                <Image
                  src={billImage}
                  alt="Bill"
                  width={44}
                  height={58}
                  className="h-14 w-11 rounded-md border object-cover"
                />
                <Button type="button" variant="outline" onClick={() => setBillImage(null)}>
                  Remove
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-14 w-full gap-2"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                Photograph the bill
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ex-category">What for</Label>
            <select
              id="ex-category"
              className={selectClass}
              value={v.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-paid">Paid from</Label>
            <select
              id="ex-paid"
              className={selectClass}
              value={v.paidFrom}
              onChange={(e) => set("paidFrom", e.target.value)}
            >
              {PAID_FROM.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ex-date">Date on the bill</Label>
            <Input
              id="ex-date"
              type="date"
              value={v.spentAt}
              max={today()}
              onChange={(e) => set("spentAt", e.target.value)}
              className="h-11"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-payee">Paid to</Label>
            <Input
              id="ex-payee"
              value={v.payee}
              onChange={(e) => set("payee", e.target.value)}
              placeholder="Bharat Petroleum, Nagole"
              className="h-11"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ex-note">Note</Label>
          <Input
            id="ex-note"
            value={v.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="School visit, Kompally"
            className="h-11"
          />
        </div>

        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Reference and GST, if the bill shows them
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ex-ref">Reference</Label>
              <Input
                id="ex-ref"
                value={v.reference}
                onChange={(e) => set("reference", e.target.value)}
                placeholder="UPI or cheque no."
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-gst">GST in the bill</Label>
              <Input
                id="ex-gst"
                value={v.gstAmount}
                onChange={(e) => set("gstAmount", e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="68.64"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-gstin">Vendor GSTIN</Label>
              <Input
                id="ex-gstin"
                value={v.vendorGstin}
                onChange={(e) => set("vendorGstin", e.target.value.toUpperCase())}
                className="h-11"
              />
            </div>
          </div>
        </details>

        <Button type="submit" size="lg" disabled={busy || !v.amount} className="w-full gap-2 text-base">
          {busy && <Loader2 className="size-5 animate-spin" />} Save expense
        </Button>
      </div>
    </form>
  );
}
