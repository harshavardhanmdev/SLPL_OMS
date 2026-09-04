"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Search, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { placeKitOrder, searchStudents } from "@/lib/kit-actions";
import { formatINR } from "@/lib/money";

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

type Student = { id: string; fullName: string; section: string; rollNumber: string };

/**
 * Pick the child off the school roster, or type the name if the roster does
 * not have them yet, then pay. The receipt lands by email and in My account.
 */
export function KitPurchaseForm({
  schoolKitId,
  classLabel,
  amount,
}: {
  schoolKitId: string;
  classLabel: string;
  amount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Student[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [picked, setPicked] = React.useState<Student | null>(null);
  const [manual, setManual] = React.useState(false);
  const [name, setName] = React.useState("");
  const [section, setSection] = React.useState("");
  const [roll, setRoll] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const term = query.trim();
  const searchable = !picked && !manual && term.length >= 2;

  // Debounced so a fast typist does not fire a query per keystroke
  React.useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void searchStudents(schoolKitId, term)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, searchable, schoolKitId]);

  // Stale hits from a previous query stay hidden rather than being cleared in
  // the effect, which would cost an extra render pass.
  const visibleResults = searchable ? results : [];

  async function pay() {
    if (!picked && !manual) return toast.error("Choose your child from the list first.");
    setBusy(true);
    try {
      const res = await placeKitOrder({
        schoolKitId,
        studentId: picked?.id,
        studentName: picked ? undefined : name,
        section: picked ? undefined : section,
        rollNumber: picked ? undefined : roll,
        guardianPhone: phone,
      });

      if (res.error === "AUTH") {
        toast.error("Please log in again.");
        router.push("/login");
        return;
      }
      if (res.error && !res.orderNumber) {
        toast.error(res.error);
        return;
      }
      if (res.mock) {
        toast.success("Test mode: order created without a real payment.");
        router.push(`/account/orders/${res.orderNumber}`);
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
        description: `${classLabel} kit for ${picked?.fullName ?? name}`,
        prefill: {
          name: res.razorpay.name,
          email: res.razorpay.email,
          contact: res.razorpay.contact,
        },
        theme: { color: "#1e2a5a" },
        modal: {
          ondismiss: () =>
            toast.info("Payment window closed. The kit is held for 30 minutes if you want to retry."),
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
            if (verify.ok) toast.success("Paid. Your kit receipt is on its way by email.");
            else toast.info("Confirming your payment. Check My account in a moment.");
            router.push("/account/kits");
          })();
        },
      });
      rzp.open();
    } finally {
      setBusy(false);
    }
  }

  const phoneValid = /^[6-9][0-9]{9}$/.test(phone);
  const readyToPay = (picked || (manual && name.trim().length >= 2)) && phoneValid;

  return (
    <div className="rounded-xl border bg-secondary/40 p-4 dark:bg-card">
      <h3 className="mb-3 font-heading font-semibold">Who is this kit for?</h3>

      {picked ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <span className="flex items-center gap-2 text-sm">
            <UserRound className="size-4 text-saffron-deep" />
            <span>
              <b>{picked.fullName}</b>
              <span className="block text-xs text-muted-foreground">
                {classLabel} {picked.section} · Roll {picked.rollNumber}
              </span>
            </span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
            Change
          </Button>
        </div>
      ) : manual ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Label htmlFor={`name-${schoolKitId}`}>Student&apos;s full name</Label>
            <Input
              id={`name-${schoolKitId}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="As written on the school records"
            />
          </div>
          <div>
            <Label htmlFor={`sec-${schoolKitId}`}>Section</Label>
            <Input
              id={`sec-${schoolKitId}`}
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="A"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={`roll-${schoolKitId}`}>Roll number (optional)</Label>
            <Input
              id={`roll-${schoolKitId}`}
              value={roll}
              onChange={(e) => setRoll(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setManual(false)}
            className="text-left text-sm text-muted-foreground underline-offset-2 hover:underline sm:col-span-3"
          >
            Search the school roster instead
          </button>
        </div>
      ) : (
        <div className="mb-4">
          <Label htmlFor={`q-${schoolKitId}`}>Search your child by name or roll number</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`q-${schoolKitId}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing the name"
              className="pl-9"
            />
          </div>
          {searchable && searching && (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Searching
            </p>
          )}
          {visibleResults.length > 0 && (
            <ul className="mt-2 divide-y overflow-hidden rounded-lg border bg-card">
              {visibleResults.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(student)}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-accent"
                  >
                    <span>{student.fullName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {classLabel} {student.section} · Roll {student.rollNumber}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchable && !searching && visibleResults.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              No match on the roster.{" "}
              <button
                type="button"
                onClick={() => {
                  setManual(true);
                  setName(query);
                }}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Enter the name yourself
              </button>
              .
            </p>
          )}
        </div>
      )}

      <div className="mb-4">
        <Label htmlFor={`phone-${schoolKitId}`}>Your mobile number</Label>
        <Input
          id={`phone-${schoolKitId}`}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          placeholder="10-digit mobile"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          We use this only for the payment and to reach you about the collection.
        </p>
      </div>

      <Button onClick={pay} disabled={!readyToPay || busy} className="w-full gap-2 sm:w-auto">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
        Pay {formatINR(amount)}
      </Button>
    </div>
  );
}
