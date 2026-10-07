"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, PenLine, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";

export type CatalogItem = {
  id: string;
  /** Heading in the picker: a price list group, Services, or the store. */
  group: string;
  title: string;
  hsnCode: string | null;
  gstRate: number;
  /** What we charge, paise. */
  price: number;
  /** Printed price, paise, when there is one. */
  mrp: number | null;
  unit: string;
};

export type OrgOption = {
  id: string;
  name: string;
  code: string;
  placeOfSupply: string;
};

export const UNITS = ["PCS", "SET", "NOS", "OTH"] as const;

const STORE = "Online store prices";

const SERIES_STYLE = {
  "Baby Steps": "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200",
  "Little Leaps": "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  UPSC: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  Services: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  "GenZ Times": "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  Store: "bg-saffron/20 text-saffron-deep",
} as const;

// Outlined, so a term reads differently from the series next to it
const TERM_STYLE = {
  "Term 2": "border-emerald-600/40 text-emerald-700 dark:text-emerald-300",
  "Term 3": "border-teal-600/40 text-teal-700 dark:text-teal-300",
  "Full set": "border-navy/40 text-navy dark:border-indigo-300/40 dark:text-indigo-200",
} as const;

function seriesOf(item: CatalogItem): keyof typeof SERIES_STYLE | null {
  if (item.group === STORE) return "Store";
  if (item.group === "Services") return "Services";
  if (item.group === "The GenZ Times") return "GenZ Times";
  const text = `${item.group} ${item.title}`.toLowerCase();
  if (text.includes("baby steps")) return "Baby Steps";
  if (text.includes("little leaps")) return "Little Leaps";
  if (text.includes("upsc")) return "UPSC";
  return null;
}

function termOf(title: string): keyof typeof TERM_STYLE | null {
  if (/term\s*2/i.test(title)) return "Term 2";
  if (/term\s*3/i.test(title)) return "Term 3";
  if (/full\s*set/i.test(title)) return "Full set";
  return null;
}

// A zero rate on a book means it comes inside a set; on a taxed service, such
// as designing, it means the amount is typed on each quotation
const zeroText = (item: CatalogItem) => (item.gstRate > 0 ? "Price typed in" : "Included in set");
const priceText = (item: CatalogItem) => (item.price > 0 ? formatINR(item.price) : zeroText(item));

function groupsOf(items: CatalogItem[]): [string, CatalogItem[]][] {
  const groups: [string, CatalogItem[]][] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last[0] === item.group) last[1].push(item);
    else groups.push([item.group, [item]]);
  }
  return groups;
}

function Tag({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * One picker for every document line. It opens as a sheet from the bottom so
 * it is easy to thumb through on a phone between school visits, with the
 * school price list on top and the long online store list folded away until
 * someone asks for it or searches.
 */
export function LinePicker({
  id,
  catalog,
  value,
  onPick,
}: {
  id: string;
  catalog: CatalogItem[];
  value: string | null;
  onPick: (item: CatalogItem | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showStore, setShowStore] = useState(false);
  const selected = catalog.find((c) => c.id === value) ?? null;

  // Every word must match somewhere in the title or group, so "grade 3 term 2" works
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searching = words.length > 0;
  const matches = searching
    ? catalog.filter((c) => {
        const hay = `${c.title} ${c.group}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
    : catalog;
  const groups = groupsOf(matches);

  function choose(item: CatalogItem | null) {
    onPick(item);
    setOpen(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          // Open where the current pick lives, so it is not hidden in a folded list
          setShowStore(selected?.group === STORE);
        }
      }}
    >
      <SheetTrigger asChild>
        <button
          type="button"
          id={id}
          aria-describedby={`${id}-value`}
          className="flex min-h-11 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span id={`${id}-value`} className="min-w-0 flex-1">
            {selected ? (
              <>
                <span className="block truncate font-medium">{selected.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {selected.group} · {priceText(selected)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Custom line, typed below</span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="max-h-[80dvh] gap-0 rounded-t-2xl p-0 sm:mx-auto sm:max-w-2xl sm:border-x"
        // On a phone the keyboard would cover half the list, so only desktop jumps to search
        onOpenAutoFocus={(e) => {
          if (window.matchMedia("(pointer: coarse)").matches) e.preventDefault();
        }}
      >
        <SheetHeader className="gap-2 border-b pb-3">
          <SheetTitle className="pr-10">Pick a line</SheetTitle>
          <SheetDescription>
            School price list first, then services. Online store prices are folded at the end.
          </SheetDescription>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles and groups"
              aria-label="Search titles and groups"
              enterKeyHint="search"
              className="h-11 pl-9"
            />
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={() => choose(null)}
            aria-current={selected === null ? "true" : undefined}
            className="flex min-h-14 w-full items-center gap-3 border-b px-4 py-3 text-left outline-none hover:bg-muted focus-visible:bg-muted"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-saffron-deep">
              <PenLine className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Custom line</span>
              <span className="block text-xs text-muted-foreground">
                Type the description and price yourself
              </span>
            </span>
            {selected === null && <Check className="size-4 shrink-0 text-green-600" aria-hidden />}
          </button>

          {groups.map(([group, items]) => {
            const folded = group === STORE && !searching && !showStore;
            return (
              <section key={group} aria-label={group}>
                <h3 className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-popover/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  <span className="truncate">{group}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 tabular-nums">
                    {items.length}
                  </span>
                </h3>

                {group === STORE && !searching && (
                  <button
                    type="button"
                    onClick={() => setShowStore((s) => !s)}
                    aria-expanded={showStore}
                    className="flex w-full items-center justify-between gap-2 border-b px-4 py-3 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                  >
                    <span>
                      <span className="block font-medium text-saffron-deep">
                        {showStore ? "Hide online store prices" : "Show online store prices"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        What a parent pays on the website, not the school price list
                      </span>
                    </span>
                    <ChevronDown
                      className={cn("size-4 shrink-0 transition-transform", showStore && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                )}

                {!folded && (
                  <ul className="divide-y">
                    {items.map((c) => {
                      const series = seriesOf(c);
                      const term = termOf(c.title);
                      const chosen = c.id === value;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => choose(c)}
                            aria-current={chosen ? "true" : undefined}
                            className={cn(
                              "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-muted focus-visible:bg-muted",
                              chosen && "bg-saffron/10",
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 font-medium">{c.title}</span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                {series && <Tag className={SERIES_STYLE[series]}>{series}</Tag>}
                                {term && <Tag className={cn("border", TERM_STYLE[term])}>{term}</Tag>}
                                <span className="text-[11px] text-muted-foreground">{c.unit}</span>
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              {c.price > 0 ? (
                                <>
                                  <span className="block font-semibold tabular-nums">
                                    {formatINR(c.price)}
                                  </span>
                                  {c.mrp !== null && c.mrp > c.price && (
                                    <span className="block text-xs text-muted-foreground tabular-nums">
                                      <span className="sr-only">MRP </span>
                                      <s>{formatINR(c.mrp)}</s>
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs font-medium text-muted-foreground">
                                  {zeroText(c)}
                                </span>
                              )}
                            </span>
                            {chosen && <Check className="size-4 shrink-0 text-green-600" aria-hidden />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}

          {searching && matches.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nothing matches &quot;{query.trim()}&quot;. Try fewer words, or use a custom line.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
