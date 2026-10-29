"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { prepareLabels } from "@/lib/parcel-label-actions";

export type PickRow = {
  kind: "order" | "subscription" | "label";
  id: string;
  name: string;
  detail: string;
  reference: string;
  /** The label number, once one has been printed */
  number: string | null;
};

export type PickGroup = { key: string; title: string; empty: string; rows: PickRow[] };

const keyOf = (r: PickRow) => `${r.kind}:${r.id}`;

/**
 * Tick who to print for, then print. Four labels share an A4 sheet, so the bar
 * says how many sheets a selection takes; a part sheet leaves the rest blank.
 */
export function LabelPicker({ issue, groups }: { issue: string; groups: PickGroup[] }) {
  const router = useRouter();
  const [ticked, setTicked] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  const toggle = (keys: string[], on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });

  // Sheet order follows the screen, not the order things were ticked
  const picks = groups.flatMap((g) => g.rows.filter((r) => ticked.has(keyOf(r))));
  const sheets = Math.ceil(picks.length / 4);

  async function print() {
    setBusy(true);
    try {
      const res = await prepareLabels({ issue, picks: picks.map((p) => ({ kind: p.kind, id: p.id })) });
      if (res.error || !res.ids) {
        toast.error(res.error ?? "Could not prepare the labels.");
        return;
      }
      router.push(`/erp/labels/print?ids=${res.ids.join(",")}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-[4.25rem] z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-sm backdrop-blur lg:top-4">
        <p className="text-sm">
          {picks.length === 0 ? (
            <span className="text-muted-foreground">Tick the parcels to label.</span>
          ) : (
            <>
              <b>{picks.length}</b> {picks.length === 1 ? "label" : "labels"} on <b>{sheets}</b> A4{" "}
              {sheets === 1 ? "sheet" : "sheets"}
              {picks.length % 4 !== 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · {4 - (picks.length % 4)} {4 - (picks.length % 4) === 1 ? "space" : "spaces"} left blank
                </span>
              )}
            </>
          )}
        </p>
        <div className="flex gap-2">
          {picks.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setTicked(new Set())}>
              Clear
            </Button>
          )}
          <Button className="gap-2" disabled={busy || picks.length === 0} onClick={() => void print()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
            Print labels
          </Button>
        </div>
      </div>

      {groups.map((g) => {
        const keys = g.rows.map(keyOf);
        const all = keys.length > 0 && keys.every((k) => ticked.has(k));
        return (
          <section key={g.key} className="rounded-2xl border bg-card">
            <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <h2 className="font-heading font-semibold">
                {g.title} <span className="text-sm font-normal text-muted-foreground">({g.rows.length})</span>
              </h2>
              {g.rows.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => toggle(keys, !all)}>
                  {all ? "Untick all" : "Tick all"}
                </Button>
              )}
            </header>
            {g.rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">{g.empty}</p>
            ) : (
              <ul className="divide-y">
                {g.rows.map((r) => {
                  const k = keyOf(r);
                  return (
                    <li key={k}>
                      <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/40">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-navy"
                          checked={ticked.has(k)}
                          onChange={(e) => toggle([k], e.target.checked)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <span className="font-medium">{r.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                          </span>
                          <span className="block text-sm text-muted-foreground">{r.detail}</span>
                          {r.number && r.kind !== "label" && (
                            <span className="mt-1 inline-block rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              Label {r.number} printed, reprints keep it
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
