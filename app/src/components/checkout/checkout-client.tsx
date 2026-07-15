"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Briefcase,
  CreditCard,
  Home,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  ShieldCheck,
  Ticket,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AddressForm } from "@/components/checkout/address-form";
import { cartStore, useCart } from "@/lib/cart-store";
import {
  confirmCod,
  getQuote,
  placeOrder,
  requestBulkOtp,
  resendCodOtp,
  verifyBulkOtp,
} from "@/lib/checkout-actions";
import type { Quote } from "@/lib/orders";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";

type AddressRow = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
};

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

const labelIcons: Record<string, typeof Home> = { HOME: Home, OFFICE: Briefcase, OTHER: MapPin };

export function CheckoutClient({ initialAddresses }: { initialAddresses: AddressRow[] }) {
  const router = useRouter();
  const cart = useCart();

  const [addresses, setAddresses] = React.useState(initialAddresses);
  const [addressId, setAddressId] = React.useState<string | null>(initialAddresses[0]?.id ?? null);
  const [showAddressForm, setShowAddressForm] = React.useState(initialAddresses.length === 0);

  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [couponInput, setCouponInput] = React.useState("");
  const [coupon, setCoupon] = React.useState<string | null>(null);

  const [method, setMethod] = React.useState<"RAZORPAY" | "COD">("RAZORPAY");
  const [placing, setPlacing] = React.useState(false);

  // Bulk-order OTP gate
  const [bulkToken, setBulkToken] = React.useState<string | undefined>();
  const [bulkOtpOpen, setBulkOtpOpen] = React.useState(false);
  const [bulkCode, setBulkCode] = React.useState("");
  const [bulkBusy, setBulkBusy] = React.useState(false);

  // COD confirmation
  const [codOrder, setCodOrder] = React.useState<string | null>(null);
  const [codCode, setCodCode] = React.useState("");
  const [codBusy, setCodBusy] = React.useState(false);

  // Mock payment (pre-KYC demo mode)
  const [mockOrder, setMockOrder] = React.useState<string | null>(null);

  const selectedAddress = addresses.find((a) => a.id === addressId) ?? null;
  const lines = React.useMemo(
    () => cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    [cart],
  );

  // Re-quote whenever cart, coupon or destination changes
  React.useEffect(() => {
    if (lines.length === 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    void getQuote(lines, coupon, selectedAddress?.pincode ?? null).then((res) => {
      if (cancelled) return;
      if (res.error === "AUTH") {
        router.push("/login?next=/checkout");
        return;
      }
      setQuoteError(res.error ?? null);
      setQuote(res.quote ?? null);
      if (res.quote?.couponError) toast.error(res.quote.couponError);
    });
    return () => {
      cancelled = true;
    };
  }, [lines, coupon, selectedAddress?.pincode, router]);

  if (cart.length === 0 && !codOrder && !mockOrder) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="font-medium">Your cart is empty.</p>
        <Button className="mt-4" asChild>
          <Link href="/categories">Browse books</Link>
        </Button>
      </div>
    );
  }

  async function submitOrder(tokenOverride?: string) {
    if (!addressId) {
      toast.error("Select or add a delivery address first.");
      return;
    }
    setPlacing(true);
    try {
      const res = await placeOrder({
        lines,
        couponCode: coupon,
        addressId,
        method,
        bulkToken: tokenOverride ?? bulkToken,
      });
      if (res.error === "AUTH") {
        router.push("/login?next=/checkout");
        return;
      }
      if (res.error === "BULK_OTP_REQUIRED") {
        setBulkOtpOpen(true);
        const sent = await requestBulkOtp();
        if (sent.ok) toast.info("We emailed you a verification code for this bulk order.");
        else toast.error(sent.error ?? "Could not send the code.");
        return;
      }
      if (res.error && !res.orderNumber) {
        toast.error(res.error);
        return;
      }

      const orderNumber = res.orderNumber!;
      if (res.codOtpSent) {
        setCodOrder(orderNumber);
        toast.info("Enter the code we emailed you to confirm Cash on Delivery.");
        return;
      }
      if (res.mock) {
        setMockOrder(orderNumber);
        return;
      }
      if (res.razorpay) {
        const ok = await loadRazorpayScript();
        if (!ok || !window.Razorpay) {
          toast.error("Could not load the payment window - open the order from My Orders to retry.");
          router.push(`/account/orders/${orderNumber}`);
          return;
        }
        const rzp = new window.Razorpay({
          key: res.razorpay.keyId,
          order_id: res.razorpay.rzpOrderId,
          amount: res.razorpay.amount,
          currency: "INR",
          name: "SLPL Store",
          description: `Order ${orderNumber}`,
          prefill: {
            name: res.razorpay.name,
            email: res.razorpay.email,
            contact: res.razorpay.contact,
          },
          theme: { color: "#1e2a5a" },
          modal: {
            ondismiss: () => {
              toast.info("Payment window closed - your order is saved as pending.");
              router.push(`/account/orders/${orderNumber}`);
            },
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
              if (verify.ok) {
                cartStore.clear();
                router.push(`/account/orders/${orderNumber}?placed=1`);
              } else {
                toast.error(
                  "We are confirming your payment - check the order page in a minute. Your money is safe.",
                );
                router.push(`/account/orders/${orderNumber}`);
              }
            })();
          },
        });
        rzp.open();
        return;
      }
      // Order saved but no payment channel (misconfiguration)
      if (res.error) toast.error(res.error);
      router.push(`/account/orders/${orderNumber}`);
    } finally {
      setPlacing(false);
    }
  }

  async function submitBulkOtp() {
    setBulkBusy(true);
    try {
      const res = await verifyBulkOtp(bulkCode);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setBulkToken(res.token);
      setBulkOtpOpen(false);
      toast.success("Verified - placing your order…");
      await submitOrder(res.token); // pass directly: state update is async
    } finally {
      setBulkBusy(false);
    }
  }

  async function submitCodOtp() {
    if (!codOrder) return;
    setCodBusy(true);
    try {
      const res = await confirmCod(codOrder, codCode);
      if (!res.ok) {
        toast.error(res.error ?? "Could not confirm.");
        return;
      }
      cartStore.clear();
      router.push(`/account/orders/${codOrder}?placed=1`);
    } finally {
      setCodBusy(false);
    }
  }

  async function mockPay(outcome: "success" | "failure") {
    if (!mockOrder) return;
    const res = await fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: mockOrder, mock: true, outcome }),
    });
    if (res.ok && outcome === "success") {
      cartStore.clear();
      router.push(`/account/orders/${mockOrder}?placed=1`);
    } else {
      toast.error("Simulated failure recorded.");
      router.push(`/account/orders/${mockOrder}`);
    }
  }

  // ── COD OTP panel ──
  if (codOrder) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10">
        <h2 className="font-heading text-2xl font-bold">Confirm Cash on Delivery</h2>
        <p className="text-sm text-muted-foreground">
          Order <b>{codOrder}</b> is reserved. Enter the 6-digit code we emailed you to confirm it.
        </p>
        <Input
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit code"
          value={codCode}
          onChange={(e) => setCodCode(e.target.value.replace(/\D/g, ""))}
          className="text-center text-xl tracking-[0.5em]"
        />
        <Button size="lg" className="w-full gap-2" disabled={codBusy || codCode.length !== 6} onClick={submitCodOtp}>
          {codBusy && <Loader2 className="size-4 animate-spin" />} Confirm order
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => {
            const r = await resendCodOtp(codOrder);
            if (r.ok) toast.success("Code re-sent.");
            else toast.error(r.error ?? "Try later.");
          }}
        >
          Resend code
        </Button>
      </div>
    );
  }

  // ── Mock payment panel ──
  if (mockOrder) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10 text-center">
        <h2 className="font-heading text-2xl font-bold">Test payment</h2>
        <p className="text-sm text-muted-foreground">
          Razorpay keys are not configured yet, so this preview simulates the
          payment for order <b>{mockOrder}</b>.
        </p>
        <div className="flex gap-3">
          <Button size="lg" className="flex-1" onClick={() => mockPay("success")}>
            Simulate success
          </Button>
          <Button size="lg" variant="outline" className="flex-1" onClick={() => mockPay("failure")}>
            Simulate failure
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Left column: address + payment */}
      <div className="space-y-8">
        <section>
          <h2 className="mb-4 font-heading text-xl font-semibold">1 · Delivery address</h2>
          {addresses.length > 0 && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {addresses.map((a) => {
                const Icon = labelIcons[a.label] ?? MapPin;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAddressId(a.id)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      addressId === a.id
                        ? "border-primary ring-2 ring-primary/30"
                        : "hover:border-saffron/60",
                    )}
                  >
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-saffron-deep">
                      <Icon className="size-3.5" /> {a.label}
                    </p>
                    <p className="mt-1 font-medium">{a.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} - {a.pincode}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{a.phone}</p>
                  </button>
                );
              })}
            </div>
          )}
          {showAddressForm ? (
            <div className="rounded-2xl border bg-card p-5">
              <AddressForm
                onSaved={(id) => {
                  setShowAddressForm(false);
                  setAddressId(id);
                  // refresh list from the server copy
                  void import("@/lib/checkout-actions").then(({ listAddresses }) =>
                    listAddresses().then((rows) => setAddresses(rows as AddressRow[])),
                  );
                }}
              />
            </div>
          ) : (
            <Button variant="outline" className="gap-2" onClick={() => setShowAddressForm(true)}>
              <Plus className="size-4" /> Add a new address
            </Button>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-heading text-xl font-semibold">2 · Payment method</h2>
          {quote?.contactRequired ? (
            <div className="rounded-2xl border-2 border-saffron/50 bg-accent/60 p-5">
              <p className="font-heading font-semibold">This is a large order 🎓</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Orders above {formatINR(2000000)} are handled personally with institutional pricing
                and secure delivery. Reach us and we will take it from here:
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button asChild className="gap-2">
                  <a href="tel:+917989191962">
                    <Phone className="size-4" /> Call +91 79891 91962
                  </a>
                </Button>
                <Button variant="outline" asChild className="gap-2">
                  <a href="https://wa.me/917989191962" target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" /> WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setMethod("RAZORPAY")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                  method === "RAZORPAY" ? "border-primary ring-2 ring-primary/30" : "hover:border-saffron/60",
                )}
              >
                <CreditCard className="size-5 text-saffron-deep" />
                <span>
                  <span className="block font-medium">Pay online</span>
                  <span className="text-sm text-muted-foreground">UPI · Cards · Netbanking · Wallets (Razorpay)</span>
                </span>
              </button>
              <button
                type="button"
                disabled={!quote || !quote.codAllowed}
                onClick={() => setMethod("COD")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                  method === "COD" ? "border-primary ring-2 ring-primary/30" : "hover:border-saffron/60",
                  quote && !quote.codAllowed && "cursor-not-allowed opacity-50",
                )}
              >
                <Banknote className="size-5 text-saffron-deep" />
                <span>
                  <span className="block font-medium">Cash on Delivery</span>
                  <span className="text-sm text-muted-foreground">
                    {quote && !quote.codAllowed
                      ? `Available only for orders up to ${formatINR(150000)}`
                      : "Pay when the books arrive (email confirmation required)"}
                  </span>
                </span>
              </button>
            </div>
          )}
        </section>

        {bulkOtpOpen && (
          <section className="rounded-2xl border-2 border-saffron/50 bg-accent/60 p-5">
            <h3 className="font-heading font-semibold">Verify this bulk order</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              For orders above {formatINR(500000)} we verify by email. Enter the 6-digit code we
              just sent to your inbox.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={bulkCode}
                onChange={(e) => setBulkCode(e.target.value.replace(/\D/g, ""))}
                className="max-w-[180px] text-center tracking-[0.4em]"
              />
              <Button disabled={bulkBusy || bulkCode.length !== 6} onClick={submitBulkOtp} className="gap-2">
                {bulkBusy && <Loader2 className="size-4 animate-spin" />} Verify
              </Button>
            </div>
          </section>
        )}
      </div>

      {/* Right column: summary */}
      <aside className="h-fit space-y-4 rounded-2xl border bg-card p-5 lg:sticky lg:top-20">
        <h2 className="font-heading text-lg font-semibold">Order summary</h2>
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
          {(quote?.items ?? cart.map((l) => ({ ...l, unitPrice: l.unitPrice }))).map((item) => (
            <li key={item.productId} className="flex justify-between gap-3">
              <span className="line-clamp-1">
                {item.title} × {item.quantity}
              </span>
              <span className="shrink-0 font-medium">{formatINR(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Ticket className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Coupon code"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              className="pl-9 uppercase"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => setCoupon(couponInput.trim() || null)}
            disabled={!couponInput.trim() && !coupon}
          >
            Apply
          </Button>
        </div>
        {quote?.couponCode && (
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Coupon {quote.couponCode} applied - you save {formatINR(quote.discount)}
          </p>
        )}

        <Separator />

        {quoteError ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{quoteError}</p>
        ) : quote ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatINR(quote.subtotal)}</span>
            </div>
            {quote.discount > 0 && (
              <div className="flex justify-between text-green-700 dark:text-green-400">
                <span>Discount</span>
                <span>−{formatINR(quote.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{quote.shippingFee === 0 ? "Free" : formatINR(quote.shippingFee)}</span>
            </div>
            {quote.etaDaysMin != null && selectedAddress && (
              <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <Truck className="size-3.5 text-saffron-deep" />
                Estimated delivery to {selectedAddress.pincode}: {quote.etaDaysMin}-{quote.etaDaysMax} days
              </p>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-heading text-lg font-bold">
              <span>Total</span>
              <span>{formatINR(quote.total)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Calculating…</p>
        )}

        {!quote?.contactRequired && (
          <Button
            size="lg"
            className="w-full gap-2"
            disabled={placing || !quote || !addressId || Boolean(quoteError)}
            onClick={() => void submitOrder()}
          >
            {placing ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {method === "COD" ? "Place COD order" : `Pay ${quote ? formatINR(quote.total) : ""}`}
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Payments are processed securely. If a payment is interrupted, it is
          auto-confirmed or auto-refunded - never lost.
        </p>
      </aside>
    </div>
  );
}
