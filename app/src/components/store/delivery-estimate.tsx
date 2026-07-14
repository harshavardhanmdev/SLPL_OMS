"use client";

import * as React from "react";
import { MapPin, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/money";

type Estimate = {
  ok: boolean;
  etaDaysMin?: number;
  etaDaysMax?: number;
  charge?: number;
  error?: string;
};

const PIN_KEY = "slpl-pincode";

/** Pincode → delivery ETA widget (PDP + cart). India-only. */
export function DeliveryEstimate({ weightGrams = 350 }: { weightGrams?: number }) {
  const [pincode, setPincode] = React.useState("");
  const [estimate, setEstimate] = React.useState<Estimate | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const saved = window.localStorage.getItem(PIN_KEY);
    if (saved) {
      setPincode(saved);
      void check(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check(pin = pincode) {
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      setEstimate({ ok: false, error: "Enter a valid 6-digit Indian pincode" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/delivery-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pincode: pin, weightGrams }),
      });
      const data = (await res.json()) as Estimate;
      setEstimate(data);
      if (data.ok) window.localStorage.setItem(PIN_KEY, pin);
    } catch {
      setEstimate({ ok: false, error: "Could not check right now — please try again" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <MapPin className="size-4 text-saffron-deep" /> Delivery estimate
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <Input
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter pincode"
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
          className="max-w-[160px] bg-background"
        />
        <Button type="submit" variant="secondary" disabled={loading}>
          {loading ? "Checking…" : "Check"}
        </Button>
      </form>
      {estimate &&
        (estimate.ok ? (
          <p className="mt-2.5 flex items-center gap-2 text-sm">
            <Truck className="size-4 shrink-0 text-green-700 dark:text-green-400" />
            <span>
              Delivery in <b>{estimate.etaDaysMin}–{estimate.etaDaysMax} days</b>
              {" · "}
              {estimate.charge === 0 ? (
                <b className="text-green-700 dark:text-green-400">Free shipping</b>
              ) : (
                <>shipping {formatINR(estimate.charge!)}</>
              )}
            </span>
          </p>
        ) : (
          <p className="mt-2.5 text-sm text-destructive">{estimate.error}</p>
        ))}
      <p className="mt-2 text-xs text-muted-foreground">We currently deliver within India only.</p>
    </div>
  );
}
