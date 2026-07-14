"use client";

/**
 * Guest cart, persisted in localStorage. Prices stored here are display
 * snapshots — the server recomputes everything at checkout. After login the
 * cart is merged into the DB cart (M4) and this store mirrors the server.
 */
import { useSyncExternalStore } from "react";

export type CartLine = {
  productId: string;
  slug: string;
  title: string;
  unitPrice: number; // paise, snapshot at add time
  image: string | null;
  quantity: number;
};

const KEY = "slpl-cart-v1";
const EVENT = "slpl-cart-change";

function read(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as CartLine[];
  } catch {
    return [];
  }
}

let snapshot: CartLine[] = [];
let loaded = false;

function ensureLoaded() {
  if (!loaded && typeof window !== "undefined") {
    snapshot = read();
    loaded = true;
  }
}

function write(lines: CartLine[]) {
  snapshot = lines;
  window.localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(EVENT));
}

export const cartStore = {
  get(): CartLine[] {
    ensureLoaded();
    return snapshot;
  },
  add(line: Omit<CartLine, "quantity">, quantity = 1) {
    ensureLoaded();
    const lines = [...snapshot];
    const existing = lines.find((l) => l.productId === line.productId);
    if (existing) existing.quantity += quantity;
    else lines.push({ ...line, quantity });
    write(lines);
  },
  setQuantity(productId: string, quantity: number) {
    ensureLoaded();
    const lines =
      quantity <= 0
        ? snapshot.filter((l) => l.productId !== productId)
        : snapshot.map((l) => (l.productId === productId ? { ...l, quantity } : l));
    write(lines);
  },
  remove(productId: string) {
    this.setQuantity(productId, 0);
  },
  clear() {
    write([]);
  },
  subscribe(cb: () => void) {
    const onChange = () => {
      snapshot = read();
      cb();
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange); // cross-tab
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  },
};

const serverEmpty: CartLine[] = [];

export function useCart(): CartLine[] {
  return useSyncExternalStore(
    cartStore.subscribe.bind(cartStore),
    () => cartStore.get(),
    () => serverEmpty,
  );
}

export function useCartCount(): number {
  const cart = useCart();
  return cart.reduce((n, l) => n + l.quantity, 0);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}
