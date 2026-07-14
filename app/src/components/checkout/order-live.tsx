"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { cartStore } from "@/lib/cart-store";

const PENDING = new Set(["AWAITING_PAYMENT", "COD_PENDING_OTP"]);

/**
 * Client side of the order page: clears the cart once after a successful
 * placement, and polls while the order is in a pending state so webhook /
 * reconciler updates appear without a manual refresh.
 */
export function OrderLive({
  orderNumber,
  status,
  placed,
}: {
  orderNumber: string;
  status: string;
  placed: boolean;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (placed) cartStore.clear();
  }, [placed]);

  React.useEffect(() => {
    if (!PENDING.has(status)) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderNumber}/status`);
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        if (data.status && data.status !== status) router.refresh();
      } catch {
        // transient network issues are fine — next tick retries
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [orderNumber, status, router]);

  return null;
}
