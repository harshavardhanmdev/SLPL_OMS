"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { voidReceipt } from "@/lib/crm-actions";

/** Void with a reason typed inline, so nobody voids a payment by a stray tap. */
export function VoidReceipt({ id, number }: { id: string; number: string }) {
  const router = useRouter();
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  if (!asking) {
    return (
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setAsking(true)}>
        <Ban className="size-3.5" /> Void
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why? Cheque bounced, wrong school"
        className="h-9 w-56"
        aria-label={`Reason for voiding ${number}`}
        autoFocus
      />
      <Button
        variant="destructive"
        size="sm"
        disabled={busy || reason.trim().length < 3}
        onClick={() => {
          setBusy(true);
          void voidReceipt({ id, reason })
            .then((res) => {
              if (res.error) toast.error(res.error);
              else {
                toast.success(`${number} voided. Any bill it had settled is open again.`);
                setAsking(false);
                router.refresh();
              }
            })
            .finally(() => setBusy(false));
        }}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Void it"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </div>
  );
}
