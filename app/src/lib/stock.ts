import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/**
 * Stock movement, bundle-aware.
 *
 * A bundle is not a thing we hold on a shelf - it is assembled from its member
 * books at packing time. So selling one kit has to move every member's stock,
 * and the bundle's own `stock` column is only a cache: how many complete kits
 * the members can currently make. Every function that changes member stock
 * calls refreshBundleStock so listings, the product page and the low-stock
 * dashboard keep reading `Product.stock` and keep telling the truth.
 *
 * A bundle with no members configured yet falls back to its own count, so an
 * unfinished kit does not read as infinite stock.
 */

type Tx = Prisma.TransactionClient;
export type StockLine = { productId: string; quantity: number };

export class StockError extends Error {}

/** Order lines to the physical products that actually leave the shelf. */
export async function expandToStockLines(tx: Tx, lines: StockLine[]): Promise<Map<string, number>> {
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      kind: true,
      bundleItems: { select: { productId: true, quantity: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const units = new Map<string, number>();
  const add = (productId: string, qty: number) =>
    units.set(productId, (units.get(productId) ?? 0) + qty);

  for (const line of lines) {
    const p = byId.get(line.productId);
    if (!p) continue; // product deleted since the order was placed
    if (p.kind === "BUNDLE" && p.bundleItems.length > 0) {
      for (const member of p.bundleItems) add(member.productId, member.quantity * line.quantity);
    } else {
      add(p.id, line.quantity);
    }
  }
  return units;
}

/**
 * Take stock off the shelf. Throws StockError when a member ran out, unless
 * `force` is set - used after a payment has already succeeded, where refusing
 * would be worse than a negative count the owner can see and correct.
 */
export async function reserveStock(
  tx: Tx,
  lines: StockLine[],
  opts: { force?: boolean } = {},
): Promise<void> {
  const units = await expandToStockLines(tx, lines);
  if (units.size === 0) return;

  for (const [productId, quantity] of units) {
    const res = await tx.product.updateMany({
      where: { id: productId, ...(opts.force ? {} : { stock: { gte: quantity } }) },
      data: { stock: { decrement: quantity } },
    });
    if (res.count === 0 && !opts.force) {
      const p = await tx.product.findUnique({ where: { id: productId }, select: { title: true } });
      throw new StockError(`“${p?.title ?? "An item"}” just went out of stock.`);
    }
  }
  await refreshBundleStock(tx, [...units.keys()]);
}

/** Put stock back: cancellations, expiries, failed payments. */
export async function releaseStock(tx: Tx, lines: StockLine[]): Promise<void> {
  const units = await expandToStockLines(tx, lines);
  if (units.size === 0) return;

  for (const [productId, quantity] of units) {
    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });
  }
  await refreshBundleStock(tx, [...units.keys()]);
}

/**
 * Recompute the cached kit count for every bundle touched by these members.
 * Pass no ids to rebuild every bundle (seed, backfill, bundle edits).
 */
export async function refreshBundleStock(tx: Tx, memberIds?: string[]): Promise<void> {
  const bundles = await tx.product.findMany({
    where: {
      kind: "BUNDLE",
      ...(memberIds ? { bundleItems: { some: { productId: { in: memberIds } } } } : {}),
    },
    select: {
      id: true,
      stock: true,
      bundleItems: { select: { quantity: true, product: { select: { stock: true } } } },
    },
  });

  for (const bundle of bundles) {
    if (bundle.bundleItems.length === 0) continue; // not configured yet, leave the manual count
    const buildable = Math.min(
      ...bundle.bundleItems.map((i) => Math.floor(i.product.stock / Math.max(1, i.quantity))),
    );
    const clamped = Math.max(0, buildable);
    if (clamped !== bundle.stock) {
      await tx.product.update({ where: { id: bundle.id }, data: { stock: clamped } });
    }
  }
}

/** Same, outside a transaction. For admin saves and one-off backfills. */
export async function refreshBundleStockNow(memberIds?: string[]): Promise<void> {
  await db.$transaction(async (tx) => refreshBundleStock(tx, memberIds));
}
