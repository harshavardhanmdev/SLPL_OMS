import "server-only";

import type { CatalogItem, OrgOption } from "@/components/erp/line-picker";
import { db } from "@/lib/db";
import { OUR_STATE } from "@/lib/quotation-math";
import { PLANS, planFromText } from "@/lib/subscription-plans";

/**
 * What a quotation or an invoice line can be picked from, in the order sales
 * reach for it: the school price list, then services at their own rates, and
 * the online catalogue last, because its prices are what a parent pays.
 */
export async function catalogForQuoting(): Promise<CatalogItem[]> {
  const [prices, services, products] = await Promise.all([
    db.priceListItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { description: "asc" }],
    }),
    db.servicePage.findMany({
      where: { isVisible: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, price: true, gstRate: true, hsnCode: true },
    }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: [{ series: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        hsnCode: true,
        gstRate: true,
        price: true,
        salePrice: true,
        unit: true,
      },
    }),
  ]);

  return [
    ...prices.map((p) => ({
      id: `price:${p.id}`,
      group: p.group,
      title: p.description,
      hsnCode: p.hsnCode,
      gstRate: p.gstRate,
      price: p.rate,
      mrp: p.mrp,
      unit: p.unit,
    })),
    // The GenZ Times at the prices readers pay on the website, so a school
    // ordering for its students is billed exactly as the magazine is sold.
    // Periodicals are HSN 4902 and nil rated.
    ...PLANS.map((p) => ({
      id: `magazine:${p.id}`,
      group: "The GenZ Times",
      title: `The GenZ Times subscription, ${p.label} (${p.issues} issues)`,
      hsnCode: "4902",
      gstRate: 0,
      price: p.price,
      mrp: p.listPrice,
      unit: "NOS",
    })),
    ...services.map((s) => ({
      id: `service:${s.id}`,
      group: "Services",
      title: s.title,
      hsnCode: s.hsnCode ?? "9992",
      gstRate: s.gstRate,
      price: s.price ?? 0,
      mrp: null,
      unit: "PCS",
    })),
    ...products.map((p) => ({
      id: p.id,
      group: "Online store prices",
      title: p.title,
      hsnCode: p.hsnCode,
      gstRate: p.gstRate,
      price: p.salePrice ?? p.price,
      mrp: p.price,
      unit: p.unit === "SET" ? "SET" : "PCS",
    })),
  ];
}

export async function organizationsForBilling(): Promise<OrgOption[]> {
  const rows = await db.organization.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, state: true },
  });
  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
    placeOfSupply: o.state || OUR_STATE,
  }));
}

/**
 * A picked line's product id, or null. Price list and service lines are
 * prefixed so they never pass for a store product id. A GenZ Times plan is
 * kept as magazine:<plan>, because a paid bill starts that subscription.
 */
export function storeProductId(id: string | null | undefined): string | null {
  if (id?.startsWith("magazine:")) return id;
  return id && !id.includes(":") ? id : null;
}

/** As above, and a GenZ Times subscription typed by hand is read as its plan. */
export function lineProductId(id: string | null | undefined, description: string): string | null {
  const kept = storeProductId(id);
  if (kept) return kept;
  const plan = planFromText(description);
  return plan ? `magazine:${plan.id}` : null;
}
