"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markKitCollectedByAdmin, markKitReady } from "@/lib/kit-admin-actions";

/** Set aside, or record a handover the school did without the QR screen. */
export function KitPurchaseActions({
  purchaseId,
  status,
}: {
  purchaseId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState("");

  async function run(fn: () => Promise<{ ok?: boolean; error?: string }>) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else {
        toast.success("Updated.");
        setNaming(false);
        setName("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (naming) {
    return (
      <div className="mt-2 space-y-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Who collected it?"
          className="h-8"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={busy || name.trim().length < 2}
            onClick={() => run(() => markKitCollectedByAdmin(purchaseId, name))}
          >
            {busy && <Loader2 className="mr-1 size-3.5 animate-spin" />} Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNaming(false)} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {status === "PAID" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => markKitReady(purchaseId))}>
          Set aside
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => setNaming(true)} disabled={busy}>
        Record handover
      </Button>
    </div>
  );
}
