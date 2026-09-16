"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Delete, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { unlockWithPin } from "@/lib/expense-pin-actions";

/**
 * A numeric pad rather than a text field: on a phone this is one thumb, and
 * the keyboard never covers the screen.
 */
export function PinPad({ next }: { next: string }) {
  const router = useRouter();
  const [pin, setPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = React.useCallback(
    async (value: string) => {
      setBusy(true);
      try {
        const res = await unlockWithPin(value);
        if (res.error) {
          toast.error(res.error);
          setPin("");
          return;
        }
        router.replace(next);
        router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [next, router],
  );

  function press(digit: string) {
    if (busy || pin.length >= 8) return;
    const value = pin + digit;
    setPin(value);
    // 4 is the common case, so unlock without making them reach for a button
    if (value.length === 4) void submit(value);
  }

  return (
    <div className="w-full max-w-xs rounded-2xl border bg-card p-6 shadow-lg">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-saffron-deep">
          <LockKeyhole className="size-6" />
        </span>
        <h1 className="font-heading text-lg font-bold">Enter your PIN</h1>
        <p className="text-sm text-muted-foreground">To log an expense on this phone.</p>
      </div>

      <div className="mb-6 flex justify-center gap-3" aria-label={`${pin.length} digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`size-3.5 rounded-full border-2 ${
              pin.length > i ? "border-navy bg-navy" : "border-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            disabled={busy}
            className="h-16 rounded-xl border bg-background font-heading text-2xl font-semibold transition active:scale-95 hover:bg-accent disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPin("")}
          disabled={busy || pin.length === 0}
          className="h-16 rounded-xl text-sm text-muted-foreground transition hover:bg-accent disabled:opacity-30"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => press("0")}
          disabled={busy}
          className="h-16 rounded-xl border bg-background font-heading text-2xl font-semibold transition active:scale-95 hover:bg-accent disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setPin((p) => p.slice(0, -1))}
          disabled={busy || pin.length === 0}
          className="flex h-16 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent disabled:opacity-30"
          aria-label="Delete last digit"
        >
          <Delete className="size-5" />
        </button>
      </div>

      {pin.length > 4 && (
        <button
          type="button"
          onClick={() => void submit(pin)}
          disabled={busy}
          className="mt-3 h-12 w-full rounded-xl bg-navy font-semibold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : "Unlock"}
        </button>
      )}

      <p className="mt-5 text-center text-sm">
        <Link href="/admin/login?next=/erp/expenses" className="text-muted-foreground hover:underline">
          Use the password instead
        </Link>
      </p>
    </div>
  );
}
