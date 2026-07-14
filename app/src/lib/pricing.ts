/**
 * Effective price resolution, shared by storefront, cart and checkout.
 * Priority: the lowest of (product sale price in window) and (active festival
 * sale event discount), floored at ₹1. MRP is the strike-through compare-at.
 */

export type PricedProduct = {
  price: number;
  mrp: number;
  salePrice: number | null;
  saleStart: Date | null;
  saleEnd: Date | null;
  categoryId: string;
};

export type ActiveSale = {
  name: string;
  bannerText: string;
  discountType: "PERCENT" | "FLAT";
  value: number;
  categoryIds: string[];
} | null;

export function saleWindowOpen(p: PricedProduct, now = new Date()): boolean {
  if (p.salePrice == null) return false;
  if (p.saleStart && now < p.saleStart) return false;
  if (p.saleEnd && now > p.saleEnd) return false;
  return true;
}

export function effectivePrice(p: PricedProduct, sale: ActiveSale, now = new Date()): number {
  let best = p.price;
  if (saleWindowOpen(p, now)) best = Math.min(best, p.salePrice!);
  if (sale && (sale.categoryIds.length === 0 || sale.categoryIds.includes(p.categoryId))) {
    const discounted =
      sale.discountType === "PERCENT"
        ? Math.round((p.price * (100 - sale.value)) / 100)
        : p.price - sale.value;
    best = Math.min(best, discounted);
  }
  return Math.max(best, 100);
}

export function discountPercent(mrp: number, price: number): number {
  if (mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
