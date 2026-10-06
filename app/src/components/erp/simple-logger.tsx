"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGift } from "@/lib/crm-actions";
import { todayLocalIso } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type Org = { id: string; name: string };

/** What was given, to whom, and what it cost us. */
export function GiftLogger({ organizations }: { organizations: Org[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const today = todayLocalIso();
  const [v, setV] = React.useState({
    organizationId: organizations[0]?.id ?? "",
    description: "",
    value: "",
    givenToName: "",
    givenOn: today,
    notes: "",
  });
  const set = (k: keyof typeof v, value: string) => setV((old) => ({ ...old, [k]: value }));

  if (!open) {
    return (
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Record a gift
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void saveGift({
          organizationId: v.organizationId,
          description: v.description,
          value: v.value ? Number(v.value) : null,
          givenToName: v.givenToName,
          givenOn: v.givenOn,
          notes: v.notes,
        })
          .then((res) => {
            if (res.error) toast.error(res.error);
            else {
              toast.success("Recorded.");
              setV((old) => ({ ...old, description: "", value: "", givenToName: "", notes: "" }));
              setOpen(false);
              router.refresh();
            }
          })
          .finally(() => setBusy(false));
      }}
      className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <h2 className="font-heading font-semibold">Gift given</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="gi-org">School</Label>
          <select
            id="gi-org"
            className={selectClass}
            value={v.organizationId}
            onChange={(e) => set("organizationId", e.target.value)}
            required
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gi-desc">What was given</Label>
          <Input
            id="gi-desc"
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            className="h-11"
            placeholder="Diary and pen set"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gi-to">To whom</Label>
          <Input
            id="gi-to"
            value={v.givenToName}
            onChange={(e) => set("givenToName", e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gi-value">What it cost, rupees</Label>
          <Input
            id="gi-value"
            inputMode="decimal"
            value={v.value}
            onChange={(e) => set("value", e.target.value.replace(/[^\d.]/g, ""))}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gi-date">When</Label>
          <Input
            id="gi-date"
            type="date"
            value={v.givenOn}
            onChange={(e) => set("givenOn", e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="gi-notes">Note</Label>
          <Input
            id="gi-notes"
            value={v.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="h-11"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Record
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
