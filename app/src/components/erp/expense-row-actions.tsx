"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ban } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { voidExpense } from "@/lib/expense-actions";

/**
 * Voiding, not deleting. The voucher number and the row stay, so the auditor
 * never sees an unexplained gap in the numbering.
 */
export function ExpenseRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await voidExpense(id, reason);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Voided.");
        setAsking(false);
        setReason("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!asking) {
    return (
      <Button variant="ghost" size="icon" aria-label="Void this entry" onClick={() => setAsking(true)}>
        <Ban className="size-4" />
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why void it?"
        className="h-9 w-48"
      />
      <Button size="sm" variant="destructive" disabled={busy || reason.trim().length < 3} onClick={run}>
        {busy && <Loader2 className="mr-1 size-3.5 animate-spin" />} Void
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(false)} disabled={busy}>
        Cancel
      </Button>
    </div>
  );
}
