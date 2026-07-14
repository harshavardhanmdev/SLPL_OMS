"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Briefcase, Home, Loader2, LocateFixed, MapPin } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAddress, type AddressInput } from "@/lib/checkout-actions";
import { cn } from "@/lib/utils";

const AddressMap = dynamic(() => import("./address-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

const labels = [
  { value: "HOME", label: "Home", icon: Home },
  { value: "OFFICE", label: "Office", icon: Briefcase },
  { value: "OTHER", label: "Other", icon: MapPin },
] as const;

export function AddressForm({ onSaved }: { onSaved: (id: string) => void }) {
  const [saving, setSaving] = React.useState(false);
  const [label, setLabel] = React.useState<AddressInput["label"]>("HOME");
  const [pin, setPin] = React.useState<{ lat: number; lng: number } | null>(null);
  const [form, setForm] = React.useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Pincode → city/state autofill (India Post public API)
  async function autofillFromPincode(pincode: string) {
    if (!/^[1-9][0-9]{5}$/.test(pincode)) return;
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = (await res.json()) as
        | [{ Status: string; PostOffice?: { District: string; State: string }[] }]
        | null;
      const po = data?.[0]?.PostOffice?.[0];
      if (po) {
        setForm((f) => ({
          ...f,
          city: f.city || po.District,
          state: f.state || po.State,
        }));
      }
    } catch {
      // autofill is best-effort only
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveAddress({
        label,
        ...form,
        lat: pin?.lat ?? null,
        lng: pin?.lng ?? null,
        isDefault: true,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Address saved");
      onSaved(res.id!);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            required
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="line1">Flat / house / building</Label>
        <Input id="line1" required value={form.line1} onChange={(e) => set("line1", e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="line2">
            Street / area <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="line2" value={form.line2} onChange={(e) => set("line2", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="landmark">
            Landmark <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="landmark" value={form.landmark} onChange={(e) => set("landmark", e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="pincode">Pincode</Label>
          <Input
            id="pincode"
            required
            inputMode="numeric"
            maxLength={6}
            value={form.pincode}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              set("pincode", v);
              if (v.length === 6) void autofillFromPincode(v);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">City / District</Label>
          <Input id="city" required value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="state">State</Label>
          <Input id="state" required value={form.state} onChange={(e) => set("state", e.target.value)} />
        </div>
      </div>

      {/* Map pin-drop for precise delivery location */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>
            Pin your exact location <span className="text-muted-foreground">(helps the courier find you)</span>
          </Label>
          {pin && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
              <LocateFixed className="size-3.5" /> Location pinned
            </span>
          )}
        </div>
        <AddressMap
          value={pin}
          onChange={setPin}
          onLocality={(loc) =>
            setForm((f) => ({
              ...f,
              city: f.city || loc.city || f.city,
              state: f.state || loc.state || f.state,
              pincode: f.pincode || loc.pincode || f.pincode,
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Save as</Label>
        <div className="flex gap-2">
          {labels.map(({ value, label: text, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setLabel(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                label === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-secondary",
              )}
            >
              <Icon className="size-4" /> {text}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" size="lg" disabled={saving} className="gap-2">
        {saving && <Loader2 className="size-4 animate-spin" />} Save address
      </Button>
    </form>
  );
}
