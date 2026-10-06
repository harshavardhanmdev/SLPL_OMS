"use client";

import { formatINR } from "@/lib/money";

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

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * One dropdown for every document line, grouped so the school price list sits
 * on top and the online store prices are clearly labelled as such.
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
  const groups: [string, CatalogItem[]][] = [];
  for (const item of catalog) {
    const last = groups[groups.length - 1];
    if (last && last[0] === item.group) last[1].push(item);
    else groups.push([item.group, [item]]);
  }

  return (
    <select
      id={id}
      className={selectClass}
      value={value ?? ""}
      onChange={(e) => onPick(catalog.find((c) => c.id === e.target.value) ?? null)}
    >
      <option value="">Custom line, typed below</option>
      {groups.map(([group, items]) => (
        <optgroup key={group} label={group}>
          {items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
              {c.price > 0 ? ` - ${formatINR(c.price)}` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
