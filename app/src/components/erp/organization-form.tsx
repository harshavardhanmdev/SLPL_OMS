"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteOrganization, saveOrganization, type OrganizationInput } from "@/lib/organization-actions";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const KINDS = [
  ["SCHOOL", "School"],
  ["COLLEGE", "College"],
  ["DISTRIBUTOR", "Distributor"],
  ["INSTITUTION", "Institution"],
  ["INDIVIDUAL", "Individual"],
] as const;

const STATUSES = [
  ["LEAD", "Lead, not yet bought"],
  ["ACTIVE", "Active customer"],
  ["DORMANT", "Dormant, gone quiet"],
  ["LOST", "Lost"],
] as const;

const SOURCES = [
  "Field prospecting",
  "Referral",
  "Website",
  "Exhibition or event",
  "Existing customer",
  "Distributor",
  "Social media",
  "Inbound call",
  "Other",
];

export function OrganizationForm({
  initial,
  people,
}: {
  initial?: OrganizationInput & { id?: string };
  people: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState<OrganizationInput>(
    initial ?? {
      name: "",
      code: "",
      kind: "SCHOOL",
      contactPerson: "",
      designation: "",
      phone: "",
      email: "",
      addressLine: "",
      city: "",
      state: "Telangana",
      pincode: "",
      gstin: "",
      ownerId: "",
      source: "Field prospecting",
      status: "LEAD",
      notes: "",
    },
  );

  const set = <K extends keyof OrganizationInput>(k: K, value: OrganizationInput[K]) =>
    setV((old) => ({ ...old, [k]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveOrganization(v);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Saved as ${res.code}.`);
        router.push(`/erp/organizations/${res.id}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const text = (
    k: keyof OrganizationInput,
    label: string,
    opts: { hint?: string; wide?: boolean } = {},
  ) => (
    <div className={`space-y-1.5 ${opts.wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={`og-${k}`}>{label}</Label>
      <Input
        id={`og-${k}`}
        value={(v[k] as string) ?? ""}
        onChange={(e) => set(k, e.target.value as never)}
        className="h-11"
      />
      {opts.hint && <p className="text-xs text-muted-foreground">{opts.hint}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-heading font-semibold">The organisation</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="og-name">Name</Label>
            <Input
              id="og-name"
              value={v.name}
              onChange={(e) => set("name", e.target.value)}
              className="h-11"
              required
            />
          </div>
          {text("code", "Customer code", {
            hint: "Leave blank and it is made from the name, the city and the month added, like GLOWAR1026. It appears in every invoice number.",
          })}
          <div className="space-y-1.5">
            <Label htmlFor="og-kind">Type</Label>
            <select
              id="og-kind"
              className={selectClass}
              value={v.kind}
              onChange={(e) => set("kind", e.target.value as never)}
            >
              {KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {text("contactPerson", "Contact person")}
          {text("designation", "Designation")}
          {text("phone", "Phone")}
          {text("email", "Email")}
          {text("gstin", "Their GSTIN")}
          <div className="space-y-1.5">
            <Label htmlFor="og-status">Status</Label>
            <select
              id="og-status"
              className={selectClass}
              value={v.status}
              onChange={(e) => set("status", e.target.value as never)}
            >
              {STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {text("addressLine", "Address", { wide: true })}
          {text("city", "City")}
          {text("pincode", "Pincode")}
          {text("state", "State")}
          <div className="space-y-1.5">
            <Label htmlFor="og-source">How we found them</Label>
            <select
              id="og-source"
              className={selectClass}
              value={v.source ?? ""}
              onChange={(e) => set("source", e.target.value)}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="og-owner">Looked after by</Label>
            <select
              id="og-owner"
              className={selectClass}
              value={v.ownerId ?? ""}
              onChange={(e) => set("ownerId", e.target.value)}
            >
              <option value="">Nobody yet</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {text("notes", "Notes", { wide: true })}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={busy} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {initial?.id ? "Save changes" : "Add the organisation"}
        </Button>
        {initial?.id && (
          <Button
            type="button"
            variant="ghost"
            className="gap-2 text-destructive"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void deleteOrganization(initial.id!)
                .then((res) => {
                  if (res.error) toast.error(res.error);
                  else {
                    toast.success("Deleted.");
                    router.push("/erp/organizations");
                  }
                })
                .finally(() => setBusy(false));
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
      </div>
    </form>
  );
}
