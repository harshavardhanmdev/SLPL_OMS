"use client";

/** Client sections of the account hub: avatar, profile, addresses, settings. */
import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Bell,
  Briefcase,
  Camera,
  Home,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AddressForm, type AddressFormInitial } from "@/components/checkout/address-form";
import { deleteAddress, setDefaultAddress } from "@/lib/checkout-actions";
import { savePrefs, updateProfile } from "@/lib/account-actions";
import type { NotificationPrefs } from "@/lib/notify";

/* ── Avatar ── */
export function AvatarUploader({ image, name }: { image: string | null; name: string }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/account/avatar", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) toast.error(data.error ?? "Upload failed");
      else {
        toast.success("Profile photo updated");
        router.refresh();
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
      />
      <div className="relative size-20 overflow-hidden rounded-full bg-primary ring-2 ring-border">
        {image?.startsWith("/") ? (
          <Image src={image} alt={name} fill sizes="80px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center font-heading text-4xl font-bold text-primary-foreground">
            {(name.trim()[0] ?? "?").toUpperCase()}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label="Change profile photo"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:scale-105"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
      </button>
    </div>
  );
}

/* ── Profile ── */
export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const router = useRouter();
  const [v, setV] = React.useState({ name, phone });
  const [busy, setBusy] = React.useState(false);
  const dirty = v.name !== name || v.phone !== phone;

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const res = await updateProfile(v);
          if (res.error) toast.error(res.error);
          else {
            toast.success("Profile saved");
            router.refresh();
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label>Full name</Label>
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Mobile number</Label>
        <Input
          inputMode="numeric"
          maxLength={10}
          value={v.phone}
          onChange={(e) => setV({ ...v, phone: e.target.value.replace(/\D/g, "") })}
          placeholder="10-digit mobile"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={email} disabled className="opacity-70" />
        <p className="text-xs text-muted-foreground">Email is your login and cannot be changed here.</p>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={!dirty || busy} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save profile
        </Button>
      </div>
    </form>
  );
}

/* ── Addresses ── */
export type AddressRow = AddressFormInitial & { id: string; isDefault: boolean };
const labelIcons = { HOME: Home, OFFICE: Briefcase, OTHER: MapPin } as const;

export function AddressesManager({ addresses }: { addresses: AddressRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<AddressRow | "new" | null>(
    addresses.length === 0 ? "new" : null,
  );

  if (editing) {
    return (
      <div className="rounded-2xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading font-semibold">
            {editing === "new" ? "Add address" : `Edit ${editing.name || "address"}`}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
        <AddressForm
          initial={editing === "new" ? undefined : editing}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {addresses.map((a) => {
          const Icon = labelIcons[(a.label as keyof typeof labelIcons) ?? "HOME"] ?? MapPin;
          return (
            <div key={a.id} className="relative rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-saffron-deep">
                  <Icon className="size-3.5" /> {a.name || a.label}
                </p>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    title={a.isDefault ? "Default address" : "Make default"}
                    className="rounded-md p-1.5 transition hover:bg-secondary"
                    onClick={async () => {
                      if (a.isDefault) return;
                      await setDefaultAddress(a.id);
                      toast.success("Default address updated");
                      router.refresh();
                    }}
                  >
                    <Star
                      className={
                        a.isDefault ? "size-4 fill-saffron text-saffron" : "size-4 text-muted-foreground"
                      }
                    />
                  </button>
                  <button
                    type="button"
                    title="Edit"
                    className="rounded-md p-1.5 transition hover:bg-secondary"
                    onClick={() => setEditing(a)}
                  >
                    <Pencil className="size-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    className="rounded-md p-1.5 transition hover:bg-secondary"
                    onClick={async () => {
                      if (!confirm("Delete this address?")) return;
                      await deleteAddress(a.id);
                      router.refresh();
                    }}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-sm font-medium">{a.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} - {a.pincode}
              </p>
              <p className="text-sm text-muted-foreground">{a.phone}</p>
              {a.isDefault && (
                <Badge variant="secondary" className="mt-2">
                  Default
                </Badge>
              )}
            </div>
          );
        })}
      </div>
      <Button variant="outline" className="gap-2" onClick={() => setEditing("new")}>
        <Plus className="size-4" /> Add a new address
      </Button>
    </div>
  );
}

/* ── Settings: notification prefs + browser permissions ── */
export function SettingsPanel({ prefs }: { prefs: NotificationPrefs }) {
  const [v, setV] = React.useState(prefs);
  const [notifPerm, setNotifPerm] = React.useState<string>("unsupported");
  const [geoPerm, setGeoPerm] = React.useState<string>("unknown");

  React.useEffect(() => {
    if ("Notification" in window) setNotifPerm(Notification.permission);
    void navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => {
        setGeoPerm(s.state);
        s.onchange = () => setGeoPerm(s.state);
      })
      .catch(() => {});
  }, []);

  async function toggle(key: keyof NotificationPrefs, value: boolean) {
    const next = { ...v, [key]: value };
    setV(next);
    await savePrefs(next);
    toast.success("Settings saved");
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4 rounded-2xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-heading font-semibold">
          <Bell className="size-4 text-saffron-deep" /> Email notifications
        </h3>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="block font-medium">Order updates</span>
            <span className="text-muted-foreground">Shipped, out for delivery, delivered</span>
          </span>
          <Switch checked={v.orderEmails} onCheckedChange={(c) => void toggle("orderEmails", c)} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="block font-medium">Offers and new releases</span>
            <span className="text-muted-foreground">Occasional promotional emails</span>
          </span>
          <Switch checked={v.promoEmails} onCheckedChange={(c) => void toggle("promoEmails", c)} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="block font-medium">SMS updates</span>
            <span className="text-muted-foreground">Order confirmation and delivery texts</span>
          </span>
          <Switch checked={v.orderSms} onCheckedChange={(c) => void toggle("orderSms", c)} />
        </label>
        <p className="text-xs text-muted-foreground">
          Payment receipts and order confirmations are always sent.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border bg-card p-5">
        <h3 className="font-heading font-semibold">Browser permissions</h3>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="block font-medium">Notifications</span>
            <span className="text-muted-foreground">Status: {notifPerm}</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={notifPerm !== "default"}
            onClick={() => void Notification.requestPermission().then(setNotifPerm)}
          >
            {notifPerm === "granted" ? "Allowed" : "Allow"}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="block font-medium">Location</span>
            <span className="text-muted-foreground">Status: {geoPerm} (used for the checkout map)</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={geoPerm === "granted"}
            onClick={() => navigator.geolocation?.getCurrentPosition(() => setGeoPerm("granted"), () => {})}
          >
            {geoPerm === "granted" ? "Allowed" : "Allow"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          These are managed by your browser; changing them here only asks for permission.
        </p>
      </div>
    </div>
  );
}
