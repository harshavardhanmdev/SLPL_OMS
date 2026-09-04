"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteSchoolKit, saveSchoolKit } from "@/lib/kit-admin-actions";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type KitRow = {
  id: string;
  academicYear: string;
  classLabel: string;
  productId: string;
  productTitle: string;
  priceLabel: string;
  stock: number;
  collectionNote: string;
  isActive: boolean;
  sold: number;
};

export function SchoolKitsPanel({
  schoolId,
  defaultYear,
  bundles,
  kits,
}: {
  schoolId: string;
  defaultYear: string;
  bundles: { id: string; title: string; price: number }[];
  kits: KitRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState({
    classLabel: "",
    productId: bundles[0]?.id ?? "",
    academicYear: defaultYear,
    collectionNote: "",
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveSchoolKit({ schoolId, ...v, isActive: true });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Kit added.");
        setV({ ...v, classLabel: "", collectionNote: "" });
        setAdding(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(kit: KitRow) {
    setBusy(true);
    try {
      const res = await saveSchoolKit({
        id: kit.id,
        schoolId,
        productId: kit.productId,
        academicYear: kit.academicYear,
        classLabel: kit.classLabel,
        collectionNote: kit.collectionNote,
        isActive: !kit.isActive,
      });
      if (res.error) toast.error(res.error);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(kitId: string) {
    setBusy(true);
    try {
      const res = await deleteSchoolKit(kitId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Kit removed.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {kits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No kits set up for this school yet.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {kits.map((kit) => (
            <li key={kit.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {kit.classLabel}
                  <Badge variant="secondary">{kit.academicYear}</Badge>
                  {!kit.isActive && <Badge variant="outline">off</Badge>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {kit.productTitle} · {kit.priceLabel} · {kit.stock} in stock · {kit.sold} sold
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => toggle(kit)}>
                  {kit.isActive ? "Turn off" : "Turn on"}
                </Button>
                {kit.sold === 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => remove(kit.id)}
                    aria-label="Remove kit"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={add} className="space-y-3 rounded-xl border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="kit-class">Class</Label>
              <Input
                id="kit-class"
                value={v.classLabel}
                onChange={(e) => setV({ ...v, classLabel: e.target.value })}
                placeholder="Grade 3"
              />
            </div>
            <div>
              <Label htmlFor="kit-year">Academic year</Label>
              <Input
                id="kit-year"
                value={v.academicYear}
                onChange={(e) => setV({ ...v, academicYear: e.target.value })}
                placeholder="2026-27"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="kit-product">Bundle product</Label>
            {bundles.length === 0 ? (
              <p className="text-sm text-destructive">
                No bundle products exist yet. Create one under Products first.
              </p>
            ) : (
              <select
                id="kit-product"
                className={selectClass}
                value={v.productId}
                onChange={(e) => setV({ ...v, productId: e.target.value })}
              >
                {bundles.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <Label htmlFor="kit-note">Collection note</Label>
            <Input
              id="kit-note"
              value={v.collectionNote}
              onChange={(e) => setV({ ...v, collectionNote: e.target.value })}
              placeholder="Collect from the school office, 9am to 3pm"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || bundles.length === 0} className="gap-2">
              {busy && <Loader2 className="size-4 animate-spin" />} Add kit
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add a kit
        </Button>
      )}
    </div>
  );
}
