"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { voidMovement } from "@/lib/stock-movement-actions";

export function VoidMovement({ id, reference }: { id: string; reference: string }) {
  const router = useRouter();
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  if (!asking) {
    return (
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setAsking(true)}>
        <Undo2 className="size-3.5" /> Void
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why, for the audit trail"
        className="h-9 w-48"
        aria-label={`Reason for voiding ${reference}`}
      />
      <Button
        variant="destructive"
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void voidMovement({ id, reason })
            .then((res) => {
              if (res.error) toast.error(res.error);
              else {
                toast.success(`${reference} voided.`);
                setAsking(false);
                router.refresh();
              }
            })
            .finally(() => setBusy(false));
        }}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Void"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </div>
  );
}
