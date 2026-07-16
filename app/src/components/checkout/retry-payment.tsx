"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** "Complete payment" for orders sitting in AWAITING_PAYMENT. */
export function RetryPayment({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function pay() {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderNumber}/pay`, { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        keyId?: string;
        rzpOrderId?: string;
        amount?: number;
        name?: string;
        email?: string;
        contact?: string;
      };
      if (!res.ok || !data.rzpOrderId) {
        toast.error(data.error ?? "Could not restart the payment.");
        router.refresh();
        return;
      }
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        toast.error("Could not load the payment window. Check your connection and try again.");
        return;
      }
      const rzp = new window.Razorpay({
        key: data.keyId,
        order_id: data.rzpOrderId,
        amount: data.amount,
        currency: "INR",
        name: "SLPL Store",
        description: `Order ${orderNumber}`,
        prefill: { name: data.name, email: data.email, contact: data.contact },
        theme: { color: "#1e2a5a" },
        modal: {
          ondismiss: () => toast.info("Payment window closed. You can try again any time before the reservation expires."),
        },
        handler: (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          void (async () => {
            const verify = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderNumber, ...response }),
            });
            if (verify.ok) toast.success("Payment confirmed!");
            else toast.info("Confirming your payment. This page will update shortly.");
            router.refresh();
          })();
        },
      });
      rzp.open();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={pay} disabled={busy} className="gap-2">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
      Complete payment
    </Button>
  );
}
