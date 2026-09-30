"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { restoreLicence, revokeLicence } from "@/lib/digital-admin-actions";

export function LicenceControls({
  id,
  code,
  revoked,
}: {
  id: string;
  code: string;
  revoked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");

  async function run(fn: () => Promise<{ ok?: boolean; error?: string }>, done: string) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else {
        toast.success(done);
        setAsking(false);
        setReason("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (revoked) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={busy}
        onClick={() => void run(() => restoreLicence(id), `${code} restored.`)}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
        Restore access
      </Button>
    );
  }

  if (!asking) {
    return (
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setAsking(true)}>
        <ShieldOff className="size-3.5" /> Withdraw access
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why, for the audit trail"
        className="h-9 w-56"
        aria-label={`Reason for withdrawing ${code}`}
      />
      <Button
        variant="destructive"
        size="sm"
        disabled={busy}
        onClick={() => void run(() => revokeLicence({ id, reason }), `${code} withdrawn.`)}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Withdraw"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </div>
  );
}
