"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveExpense } from "@/lib/expense-actions";
import { EXPENSE_CATEGORIES, PAID_FROM } from "@/lib/expense-constants";
import { saveVendor } from "@/lib/vendor-actions";
import { todayLocalIso } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export type VendorDraft = {
  id?: string;
  name: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstin: string;
  payTo: string;
  notes: string;
  /** "" when it is not paid every month. */
  recurringDay: string;
  /** Rupees, "" when it varies. */
  recurringAmount: string;
  isActive: boolean;
};

const BLANK: VendorDraft = {
  name: "",
  category: "PRINTING",
  contactPerson: "",
  phone: "",
  email: "",
  gstin: "",
  payTo: "",
  notes: "",
  recurringDay: "",
  recurringAmount: "",
  isActive: true,
};

/** A new vendor, or changes to one. */
export function VendorForm({ initial }: { initial?: VendorDraft }) {
  const router = useRouter();
  const [v, setV] = React.useState<VendorDraft>(initial ?? BLANK);
  const [busy, setBusy] = React.useState(false);
  const set = (patch: Partial<VendorDraft>) => setV((o) => ({ ...o, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveVendor({
        ...v,
        recurringDay: v.recurringDay ? Number(v.recurringDay) : null,
        recurringAmount: v.recurringDay && v.recurringAmount ? Number(v.recurringAmount) : null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${v.name} saved.`);
      if (initial?.id) router.refresh();
      else router.push(`/erp/vendors/${res.id}`);
    } finally {
      setBusy(false);
    }
  }

  const field = (
    key: keyof VendorDraft,
    label: string,
    opts: { wide?: boolean; placeholder?: string } = {},
  ) => (
    <div className={`space-y-1.5 ${opts.wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={`vd-${key}`}>{label}</Label>
      <Input
        id={`vd-${key}`}
        value={String(v[key] ?? "")}
        onChange={(e) => set({ [key]: e.target.value } as Partial<VendorDraft>)}
        placeholder={opts.placeholder}
        className="h-11"
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="vd-name">Vendor name</Label>
          <Input
            id="vd-name"
            value={v.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="SV Traders"
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="vd-category">Their payments go under</Label>
          <select
            id="vd-category"
            className={selectClass}
            value={v.category}
            onChange={(e) => set({ category: e.target.value })}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {field("contactPerson", "Contact person")}
        {field("phone", "Phone")}
        {field("email", "Email")}
        {field("gstin", "GSTIN")}
        {field("payTo", "Pay to: bank account or UPI ID", { wide: true })}
      </div>

      <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            id="vd-recurring"
            type="checkbox"
            checked={Boolean(v.recurringDay)}
            onChange={(e) => set({ recurringDay: e.target.checked ? "5" : "", recurringAmount: "" })}
            className="size-4"
          />
          Paid every month, like rent or electricity
        </label>
        {v.recurringDay && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vd-day">Due on day</Label>
              <select
                id="vd-day"
                className={selectClass}
                value={v.recurringDay}
                onChange={(e) => set({ recurringDay: e.target.value })}
              >
                {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                  <option key={d} value={d}>
                    {d} of each month
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vd-amount">Usual amount, rupees</Label>
              <Input
                id="vd-amount"
                inputMode="decimal"
                value={v.recurringAmount}
                onChange={(e) => set({ recurringAmount: e.target.value.replace(/[^\d.]/g, "") })}
                placeholder="Leave empty if it varies"
                className="h-11"
              />
            </div>
          </div>
        )}
      </div>

      {field("notes", "Notes", { wide: true })}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="gap-2" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {initial?.id ? "Save changes" : "Add the vendor"}
        </Button>
        {initial?.id && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.isActive}
              onChange={(e) => set({ isActive: e.target.checked })}
            />
            Still a vendor
          </label>
        )}
      </div>
    </form>
  );
}

/**
 * A payment to this vendor. It goes into the expense log like any other
 * expense, with the vendor attached, so it is counted once and in both places.
 */
export function VendorPayForm({
  vendor,
}: {
  vendor: {
    id: string;
    name: string;
    category: string;
    gstin: string | null;
    recurringAmount: number | null;
  };
}) {
  const router = useRouter();
  const blank = {
    amount: vendor.recurringAmount ? String(vendor.recurringAmount / 100) : "",
    spentAt: todayLocalIso(),
    category: vendor.category,
    paidFrom: "CURRENT_ACCOUNT",
    reference: "",
    note: "",
  };
  const [v, setV] = React.useState(blank);
  const [billImage, setBillImage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const set = (patch: Partial<typeof blank>) => setV((o) => ({ ...o, ...patch }));

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      // "receipt" keeps the bill to staff only
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
        amount: Number(v.amount) || 0,
        category: v.category,
        paidFrom: v.paidFrom,
        payee: vendor.name,
        note: v.note,
        reference: v.reference,
        billImage,
        gstAmount: null,
        vendorGstin: vendor.gstin ?? "",
        vendorId: vendor.id,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Paid. In the expense log as ${res.voucherNo}.`);
      setV(blank);
      setBillImage(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="pay" onSubmit={submit} className="scroll-mt-20 space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="font-heading font-semibold">Record a payment</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vp-amount">Amount, rupees</Label>
          <Input
            id="vp-amount"
            inputMode="decimal"
            value={v.amount}
            onChange={(e) => set({ amount: e.target.value.replace(/[^\d.]/g, "") })}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vp-date">Paid on</Label>
          <Input
            id="vp-date"
            type="date"
            max={todayLocalIso()}
            value={v.spentAt}
            onChange={(e) => set({ spentAt: e.target.value })}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vp-from">Paid from</Label>
          <select
            id="vp-from"
            className={selectClass}
            value={v.paidFrom}
            onChange={(e) => set({ paidFrom: e.target.value })}
          >
            {PAID_FROM.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vp-category">Goes under</Label>
          <select
            id="vp-category"
            className={selectClass}
            value={v.category}
            onChange={(e) => set({ category: e.target.value })}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vp-ref">UTR, cheque or bill number</Label>
          <Input
            id="vp-ref"
            value={v.reference}
            onChange={(e) => set({ reference: e.target.value })}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vp-note">What it was for</Label>
          <Input
            id="vp-note"
            value={v.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="October rent"
            className="h-11"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        {billImage ? (
          <>
            <Image
              src={billImage}
              alt="Bill"
              width={44}
              height={58}
              className="h-14 w-11 rounded-md border object-cover"
            />
            <Button type="button" variant="outline" onClick={() => setBillImage(null)}>
              Remove the photo
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            Add a photo of the bill
          </Button>
        )}
        <Button type="submit" className="ml-auto gap-2" disabled={busy || uploading}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Record the payment
        </Button>
      </div>
    </form>
  );
}
