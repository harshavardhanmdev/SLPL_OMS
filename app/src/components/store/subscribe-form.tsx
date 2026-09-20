"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/money";
import { subscribe } from "@/lib/subscription-actions";
import { PLANS, savingsPercent } from "@/lib/subscription-plans";

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

export function SubscribeForm({
  signedIn,
  knownName,
  knownEmail,
  knownPhone,
}: {
  signedIn: boolean;
  knownName: string;
  knownEmail: string;
  knownPhone: string;
}) {
  const router = useRouter();
  const [planId, setPlanId] = React.useState(PLANS.find((p) => p.popular)?.id ?? PLANS[0].id);
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState({
    name: knownName,
    email: knownEmail,
    phone: knownPhone,
    line1: "",
    line2: "",
    city: "",
    state: "Telangana",
    pincode: "",
    website: "",
  });

  const set = (k: keyof typeof v, value: string) => setV((old) => ({ ...old, [k]: value }));
  const plan = PLANS.find((p) => p.id === planId)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await subscribe({ planId, ...v });

      if (res.error === "AUTH_REQUIRED") {
        toast.error("Please create an account or log in first, so we can track your subscription.");
        router.push(`/login?next=/subscribe`);
        return;
      }
      if (res.error && !res.orderNumber) {
        toast.error(res.error);
        return;
      }
      if (res.mock) {
        toast.success("Test mode: subscription created without a real payment.");
        router.push("/account/subscriptions");
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
        description: `The GenZ Times, ${plan.label} subscription`,
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
            if (verify.ok) toast.success("Subscribed. Check your email for the details.");
            else toast.info("Confirming your payment. Check My account in a moment.");
            router.push("/account/subscriptions");
          })();
        },
      });
      rzp.open();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Term</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLANS.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition ${
                planId === p.id ? "border-saffron bg-accent/50" : "hover:bg-accent/30"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="plan"
                  value={p.id}
                  checked={planId === p.id}
                  onChange={() => setPlanId(p.id)}
                  className="size-4"
                />
                <span>
                  <span className="block font-medium">{p.label}</span>
                  <span className="block text-xs text-muted-foreground">{p.issues} issues</span>
                </span>
              </span>
              <span className="text-right">
                <span className="block font-heading font-bold">{formatINR(p.price)}</span>
                <span className="block text-xs text-green-700 dark:text-green-400">
                  {savingsPercent(p)}% off
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sub-name">Reader&apos;s name</Label>
          <Input
            id="sub-name"
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-phone">Mobile number</Label>
          <Input
            id="sub-phone"
            value={v.phone}
            onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            className="h-11"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sub-email">Email</Label>
        <Input
          id="sub-email"
          type="email"
          value={v.email}
          onChange={(e) => set("email", e.target.value)}
          className="h-11"
          required
        />
        <p className="text-xs text-muted-foreground">
          Where the confirmation and the renewal reminder go.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sub-line1">Address</Label>
        <Input
          id="sub-line1"
          value={v.line1}
          onChange={(e) => set("line1", e.target.value)}
          placeholder="House number, street"
          className="h-11"
          required
        />
        <Input
          value={v.line2}
          onChange={(e) => set("line2", e.target.value)}
          placeholder="Area, landmark (optional)"
          className="h-11"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="sub-city">City</Label>
          <Input
            id="sub-city"
            value={v.city}
            onChange={(e) => set("city", e.target.value)}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-state">State</Label>
          <Input
            id="sub-state"
            value={v.state}
            onChange={(e) => set("state", e.target.value)}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-pin">Pincode</Label>
          <Input
            id="sub-pin"
            value={v.pincode}
            onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            className="h-11"
            required
          />
        </div>
      </div>

      {/* Honeypot: hidden from readers, filled only by bots */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={v.website}
        onChange={(e) => set("website", e.target.value)}
        className="absolute left-[-9999px] size-0"
      />

      <Button type="submit" size="lg" disabled={busy} className="w-full gap-2 text-base sm:w-auto">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <CreditCard className="size-5" />}
        Pay {formatINR(plan.price)} for {plan.issues} issues
      </Button>
      {!signedIn && (
        <p className="text-xs text-muted-foreground">
          You will be asked to sign in first, so your subscription is saved to your account.
        </p>
      )}
    </form>
  );
}
