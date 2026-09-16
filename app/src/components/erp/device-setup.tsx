"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trustThisDevice, untrustThisDevice } from "@/lib/expense-pin-actions";

/**
 * Set up quick logging on a phone: choose a PIN once, then this device asks for
 * the PIN instead of the full password.
 */
export function DeviceSetup({ trusted }: { trusted: boolean }) {
  const router = useRouter();
  const [pin, setPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<{ ok?: boolean; error?: string }>, done: string) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else {
        toast.success(done);
        setPin("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-heading font-semibold">
        <Smartphone className="size-4 text-saffron-deep" /> Quick logging on this phone
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {trusted
          ? "This device is set up. It asks for the PIN instead of the password."
          : "Choose a PIN and this device will ask for it instead of the full password. Add the page to your home screen and logging a bill takes two taps."}
      </p>

      {trusted ? (
        <Button
          variant="outline"
          className="mt-3"
          disabled={busy}
          onClick={() => run(untrustThisDevice, "This device no longer trusted.")}
        >
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Forget this device
        </Button>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="4 to 8 digits"
            inputMode="numeric"
            type="password"
            className="h-11 w-40"
          />
          <Button
            disabled={busy || pin.length < 4}
            onClick={() => run(() => trustThisDevice(pin), "Set. This phone now unlocks with the PIN.")}
          >
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Trust this phone
          </Button>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        The PIN only works on a phone that has signed in with the password at least once, so the
        PIN alone is not enough to get in.
      </p>
    </section>
  );
}
