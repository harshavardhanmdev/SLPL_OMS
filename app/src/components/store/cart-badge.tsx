"use client";

import { useCartCount } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

/** Live cart-count bubble; hidden at zero. */
export function CartBadge({ className }: { className?: string }) {
  const count = useCartCount();
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-saffron font-bold text-navy",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
