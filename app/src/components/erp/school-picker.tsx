"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveOrganization } from "@/lib/organization-actions";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type Option = { id: string; name: string };

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const wordsOf = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !["school", "high", "the", "public", "international", "and"].includes(w));

/**
 * Picks a school, with "Add a new school" right in the list for one met on
 * the road. A name close to one already on record is pointed out first, so a
 * school never ends up with two records. Lives inside other forms, so it is a
 * plain block, not a form of its own.
 */
export function SchoolPicker({
  id,
  value,
  onChange,
  organizations,
  noneLabel,
  canAdd,
}: {
  id: string;
  value: string;
  onChange: (id: string) => void;
  organizations: Option[];
  /** The first choice when no school is picked yet, or none to require one */
  noneLabel?: string;
  canAdd: boolean;
}) {
  const [extra, setExtra] = React.useState<Option[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState({ name: "", city: "", contactPerson: "", phone: "" });
  const options = [...organizations, ...extra.filter((e) => !organizations.some((o) => o.id === e.id))];

  const typed = squash(v.name);
  const similar =
    typed.length < 3
      ? []
      : options
          .filter((o) => {
            const known = squash(o.name);
            if (known.includes(typed) || typed.includes(known)) return true;
            const mine = wordsOf(v.name);
            return (
              mine.length > 0 &&
              wordsOf(o.name).filter((w) => mine.includes(w)).length >= Math.min(2, mine.length)
            );
          })
          .slice(0, 3);

  async function add() {
    if (v.name.trim().length < 2) {
      toast.error("Enter the school's name.");
      return;
    }
    setBusy(true);
    try {
      const res = await saveOrganization({
        name: v.name.trim(),
        code: "",
        kind: "SCHOOL",
        contactPerson: v.contactPerson,
        designation: "",
        phone: v.phone,
        email: "",
        addressLine: "",
        city: v.city,
        state: "Telangana",
        pincode: "",
        gstin: "",
        strength: null,
        board: "",
        ownerId: null,
        source: "Field prospecting",
        referredBy: "",
        status: "LEAD",
        notes: "",
      });
      if (res.error || !res.id) {
        toast.error(res.error ?? "Could not add the school.");
        return;
      }
      setExtra((old) => [...old, { id: res.id!, name: v.name.trim() }]);
      onChange(res.id);
      toast.success(`Added ${v.name.trim()} as ${res.code}.`);
      setV({ name: "", city: "", contactPerson: "", phone: "" });
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <select
        id={id}
        className={selectClass}
        value={adding ? "__new" : value}
        onChange={(e) => {
          if (e.target.value === "__new") setAdding(true);
          else {
            setAdding(false);
            onChange(e.target.value);
          }
        }}
      >
        {noneLabel !== undefined && <option value="">{noneLabel}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
        {canAdd && <option value="__new">+ Add a new school</option>}
      </select>
      {adding && (
        <div className="space-y-2 rounded-xl border border-dashed bg-muted/40 p-3">
          <p className="text-sm font-medium">A new school</p>
          <Input
            id={`${id}-new-name`}
            aria-label="School name"
            value={v.name}
            onChange={(e) => setV((o) => ({ ...o, name: e.target.value }))}
            placeholder="School name"
            className="h-11"
            autoFocus
          />
          {similar.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="text-saffron-deep">Already on record, is it one of these?</p>
              <div className="flex flex-wrap gap-1.5">
                {similar.map((o) => (
                  <Button
                    key={o.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onChange(o.id);
                      setAdding(false);
                    }}
                  >
                    Use {o.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              id={`${id}-new-city`}
              aria-label="Area or city"
              value={v.city}
              onChange={(e) => setV((o) => ({ ...o, city: e.target.value }))}
              placeholder="Area or city"
              className="h-11"
            />
            <Input
              id={`${id}-new-contact`}
              aria-label="Contact person"
              value={v.contactPerson}
              onChange={(e) => setV((o) => ({ ...o, contactPerson: e.target.value }))}
              placeholder="Contact person"
              className="h-11"
            />
            <Input
              id={`${id}-new-phone`}
              aria-label="Phone"
              inputMode="tel"
              value={v.phone}
              onChange={(e) => setV((o) => ({ ...o, phone: e.target.value }))}
              placeholder="Phone"
              className="h-11"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="gap-1.5" disabled={busy} onClick={() => void add()}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add the
              school
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
