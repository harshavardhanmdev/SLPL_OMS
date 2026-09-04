"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSchool, type SchoolInput } from "@/lib/kit-admin-actions";

const empty: SchoolInput = {
  code: "",
  name: "",
  city: "",
  state: "Telangana",
  udiseCode: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  isActive: true,
};

export function SchoolForm({ school }: { school?: SchoolInput }) {
  const router = useRouter();
  const [v, setV] = React.useState<SchoolInput>(school ?? empty);
  const [busy, setBusy] = React.useState(false);

  const set = (key: keyof SchoolInput, value: string | boolean) =>
    setV((old) => ({ ...old, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveSchool(v);
      if (res.error) toast.error(res.error);
      else {
        toast.success(school ? "School updated." : "School added.");
        if (!school) setV(empty);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sc-code">Code</Label>
          <Input
            id="sc-code"
            value={v.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            placeholder="SLPL-HYD-01"
          />
        </div>
        <div>
          <Label htmlFor="sc-udise">UDISE code</Label>
          <Input
            id="sc-udise"
            value={v.udiseCode ?? ""}
            onChange={(e) => set("udiseCode", e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="sc-name">School name</Label>
        <Input id="sc-name" value={v.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sc-city">City</Label>
          <Input id="sc-city" value={v.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sc-state">State</Label>
          <Input id="sc-state" value={v.state} onChange={(e) => set("state", e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="sc-contact">Contact person</Label>
        <Input
          id="sc-contact"
          value={v.contactName ?? ""}
          onChange={(e) => set("contactName", e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sc-phone">Phone</Label>
          <Input
            id="sc-phone"
            value={v.contactPhone ?? ""}
            onChange={(e) => set("contactPhone", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="sc-email">Email</Label>
          <Input
            id="sc-email"
            value={v.contactEmail ?? ""}
            onChange={(e) => set("contactEmail", e.target.value)}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={v.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className="size-4"
        />
        Active (parents can buy kits)
      </label>
      <Button type="submit" disabled={busy} className="w-full gap-2">
        {busy && <Loader2 className="size-4 animate-spin" />}
        {school ? "Save school" : "Add school"}
      </Button>
    </form>
  );
}
