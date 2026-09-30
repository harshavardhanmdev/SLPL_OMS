"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Monitor } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buyDigitalEdition } from "@/lib/digital-actions";

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

/**
 * Buying a digital edition, outside the cart.
 *
 * Mirrors the subscribe form: one line, no address, no COD. On payment the
 * webhook or this callback grants the licence, and the reader lands in the
 * reader itself.
 */
export function BuyDigitalButton({
  slug,
  title,
  price,
  owned,
}: {
  slug: string;
  title: string;
  price: string;
  owned: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  if (owned) {
    return (
      <Button size="lg" className="gap-2" onClick={() => router.push(`/read/${slug}`)}>
        <Monitor className="size-4" /> Read now
      </Button>
    );
  }

  async function buy() {
    setBusy(true);
    try {
      const res = await buyDigitalEdition({ slug });

      if (res.error === "AUTH_REQUIRED") {
        toast.error("Create an account or sign in first, so the issue is saved to your library.");
        router.push(`/login?next=/product/${slug}`);
        return;
      }
      if (res.alreadyOwned && res.readHref) {
        router.push(res.readHref);
        return;
      }
      if (res.error && !res.orderNumber) {
        toast.error(res.error);
        return;
      }
      if (res.mock) {
        toast.success("Test mode: bought without a real payment.");
        router.push(res.readHref ?? "/account/library");
        return;
      }
      if (!res.razorpay) {
        toast.error(res.error ?? "Could not start the payment.");
        return;
      }

      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        toast.error("Could not load the payment window. Check your connection and try again.");
        return;
      }
      const rzp = new window.Razorpay({
        key: res.razorpay.keyId,
        order_id: res.razorpay.rzpOrderId,
        amount: res.razorpay.amount,
        currency: "INR",
        name: "SLPL Store",
        description: title,
        prefill: {
          name: res.razorpay.name,
          email: res.razorpay.email,
          contact: res.razorpay.contact,
        },
        theme: { color: "#1e2a5a" },
        modal: {
          ondismiss: () => toast.info("Payment window closed. Nothing has been charged."),
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
              body: JSON.stringify({ orderNumber: res.orderNumber, ...response }),
            });
            if (verify.ok) {
              toast.success("Paid. Opening your copy.");
              router.push(res.readHref ?? "/account/library");
            } else {
              toast.info("Confirming your payment. Check My library in a moment.");
              router.push("/account/library");
            }
          })();
        },
      });
      rzp.open();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="lg" className="gap-2" disabled={busy} onClick={() => void buy()}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Monitor className="size-4" />}
      Buy and read, {price}
    </Button>
  );
}
