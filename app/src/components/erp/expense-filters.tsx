"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPENSE_CATEGORIES, PAID_FROM } from "@/lib/expense-constants";
import { DAYS, PERIODS } from "@/lib/expense-query";

/**
 * Every filter lives in the URL, so a view can be bookmarked, sent on, or
 * handed to the statement page and printed exactly as it was found.
 */
export function ExpenseFilters({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [text, setText] = React.useState(params.get("q") ?? "");
  const [open, setOpen] = React.useState(
    Boolean(params.get("cat") || params.get("mode") || params.get("dow") || params.get("from")),
  );

  const set = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router],
  );

  // Debounced so typing a payee does not fire a query per keystroke
  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (text === current) return;
    const timer = setTimeout(() => set({ q: text || null }), 350);
    return () => clearTimeout(timer);
  }, [text, params, set]);

  const toggleIn = (key: string, value: string) => {
    const list = (params.get(key) ?? "").split(",").filter(Boolean);
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    set({ [key]: next.join(",") || null });
  };

  const has = (key: string, value: string) =>
    (params.get(key) ?? "").split(",").filter(Boolean).includes(value);

  const period = params.get("period") ?? (params.get("from") || params.get("to") ? "" : "fy");
  const activeCount =
    (params.get("cat") ? params.get("cat")!.split(",").length : 0) +
    (params.get("mode") ? params.get("mode")!.split(",").length : 0) +
    (params.get("dow") ? params.get("dow")!.split(",").length : 0) +
    (params.get("from") || params.get("to") ? 1 : 0);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${
      active ? "border-navy bg-navy text-white" : "hover:bg-accent"
    }`;

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 print:hidden">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Payee, note, voucher or reference"
            className="h-11 pl-9"
            aria-label="Search expenses"
          />
          {text && (
            <button
              type="button"
              onClick={() => setText("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button
          type="button"
          variant={activeCount > 0 ? "default" : "outline"}
          className="h-11 shrink-0 gap-2"
          onClick={() => setOpen((o) => !o)}
        >
          <SlidersHorizontal className="size-4" />
          {activeCount > 0 ? activeCount : "Filter"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={chip(period === p.value)}
            onClick={() => set({ period: p.value, from: null, to: null })}
          >
            {p.label}
          </button>
        ))}
      </div>

      {open && (
        <div className="space-y-4 border-t pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-from">From</Label>
              <Input
                id="f-from"
                type="date"
                className="h-11"
                value={params.get("from") ?? ""}
                onChange={(e) => set({ from: e.target.value || null, period: null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-to">To</Label>
              <Input
                id="f-to"
                type="date"
                className="h-11"
                value={params.get("to") ?? ""}
                onChange={(e) => set({ to: e.target.value || null, period: null })}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Day of the week</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={chip(has("dow", d.value))}
                  onClick={() => toggleIn("dow", d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">How it was paid</Label>
            <div className="flex flex-wrap gap-2">
              {PAID_FROM.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={chip(has("mode", p.value))}
                  onClick={() => toggleIn("mode", p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Head</Label>
            <div className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={chip(has("cat", c.value))}
                  onClick={() => toggleIn("cat", c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
            <span className="text-muted-foreground">
              {resultCount} {resultCount === 1 ? "entry" : "entries"} match
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setText("");
                router.push(pathname);
              }}
            >
              Clear everything
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
