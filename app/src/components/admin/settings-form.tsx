"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSettings } from "@/lib/admin-actions";

export type SettingsValues = {
  cod_max_order_value: number; // paise
  bulk_otp_threshold: number;
  contact_us_threshold: number;
  free_shipping_threshold: number;
  shipping_flat_fee: number;
  origin_pincode: string;
  store_notice: string;
  contact_phone: string;
  contact_email: string;
};

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState({
    cod_max_order_value: String(initial.cod_max_order_value / 100),
    bulk_otp_threshold: String(initial.bulk_otp_threshold / 100),
    contact_us_threshold: String(initial.contact_us_threshold / 100),
    free_shipping_threshold: String(initial.free_shipping_threshold / 100),
    shipping_flat_fee: String(initial.shipping_flat_fee / 100),
    origin_pincode: initial.origin_pincode,
    store_notice: initial.store_notice,
    contact_phone: initial.contact_phone,
    contact_email: initial.contact_email,
  });

  function set(key: keyof typeof v, value: string) {
    setV((old) => ({ ...old, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveSettings({
        cod_max_order_value: String(Math.round(Number(v.cod_max_order_value) * 100)),
        bulk_otp_threshold: String(Math.round(Number(v.bulk_otp_threshold) * 100)),
        contact_us_threshold: String(Math.round(Number(v.contact_us_threshold) * 100)),
        free_shipping_threshold: String(Math.round(Number(v.free_shipping_threshold) * 100)),
        shipping_flat_fee: String(Math.round(Number(v.shipping_flat_fee) * 100)),
        origin_pincode: v.origin_pincode,
        store_notice: v.store_notice,
        contact_phone: v.contact_phone,
        contact_email: v.contact_email,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Settings saved");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const money = (key: keyof typeof v, label: string, hint: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input inputMode="decimal" value={v[key]} onChange={(e) => set(key, e.target.value)} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <div className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="font-heading font-semibold">Order thresholds (₹)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {money("cod_max_order_value", "COD allowed up to", "Cash on Delivery is offered only below this order value.")}
          {money("bulk_otp_threshold", "Email OTP from", "Orders at or above this value need an email OTP before placing.")}
          {money("contact_us_threshold", "Contact-us from", "At or above this, checkout is replaced by a call/WhatsApp prompt.")}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="font-heading font-semibold">Shipping</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {money("shipping_flat_fee", "Flat shipping fee (₹)", "Charged when the courier API has no live quote.")}
          {money("free_shipping_threshold", "Free shipping above (₹)", "0 disables free shipping.")}
          <div className="space-y-1.5">
            <Label>Origin pincode</Label>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={v.origin_pincode}
              onChange={(e) => set("origin_pincode", e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-xs text-muted-foreground">Where parcels ship from (used for delivery estimates).</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="font-heading font-semibold">Storefront</h2>
        <div className="space-y-1.5">
          <Label>Notice bar (empty = hidden)</Label>
          <Input
            value={v.store_notice}
            onChange={(e) => set("store_notice", e.target.value)}
            placeholder="e.g. Orders placed after Oct 28 ship after Diwali holidays."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Contact phone</Label>
            <Input value={v.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact email</Label>
            <Input type="email" value={v.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" className="gap-2" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save settings
      </Button>
    </form>
  );
}
