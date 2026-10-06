"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGift, saveSample } from "@/lib/crm-actions";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type Org = { id: string; name: string };

/** What was left with a school, and whether it ever came back. */
export function SampleLogger({ organizations }: { organizations: Org[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = React.useState({
    organizationId: organizations[0]?.id ?? "",
    description: "",
    quantity: "1",
    issuedOn: today,
    status: "WITH_SCHOOL",
    notes: "",
  });
  const set = (k: keyof typeof v, value: string) => setV((old) => ({ ...old, [k]: value }));

  if (!open) {
    return (
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Record samples given
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void saveSample({
          organizationId: v.organizationId,
          description: v.description,
          quantity: Number(v.quantity) || 1,
          issuedOn: v.issuedOn,
          status: v.status as never,
          notes: v.notes,
        })
          .then((res) => {
            if (res.error) toast.error(res.error);
            else {
              toast.success("Recorded.");
              setV((old) => ({ ...old, description: "", quantity: "1", notes: "" }));
              setOpen(false);
              router.refresh();
            }
          })
          .finally(() => setBusy(false));
      }}
      className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <h2 className="font-heading font-semibold">Samples given</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sa-org">School</Label>
          <select
            id="sa-org"
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
          <Label htmlFor="sa-desc">What was left</Label>
          <Input
            id="sa-desc"
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            className="h-11"
            placeholder="Grade 6 Skill Builders set"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-qty">How many</Label>
          <Input
            id="sa-qty"
            inputMode="numeric"
            value={v.quantity}
            onChange={(e) => set("quantity", e.target.value.replace(/\D/g, ""))}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-date">When</Label>
          <Input
            id="sa-date"
            type="date"
            value={v.issuedOn}
            onChange={(e) => set("issuedOn", e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-status">Where is it now</Label>
          <select
            id="sa-status"
            className={selectClass}
            value={v.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="WITH_SCHOOL">Still with the school</option>
            <option value="RETURNED">Returned to us</option>
            <option value="CONVERTED">Turned into an order</option>
            <option value="WRITTEN_OFF">Written off</option>
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sa-notes">Note</Label>
          <Input
            id="sa-notes"
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

/** What was given, to whom, and what it cost us. */
export function GiftLogger({ organizations }: { organizations: Org[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);
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
