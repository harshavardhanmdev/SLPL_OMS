"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markCollected } from "@/lib/kit-staff-actions";

/** School staff handover button, shown on the receipt once staff are signed in. */
export function KitCollectAction({
  accessToken,
  status,
}: {
  accessToken: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  if (status === "PENDING" || status === "CANCELLED") {
    return (
      <p className="text-sm text-muted-foreground">
        This kit cannot be handed over: it is {status === "PENDING" ? "unpaid" : "cancelled"}.
      </p>
    );
  }

  async function collect() {
    setBusy(true);
    try {
      const res = await markCollected(accessToken);
      if (res.error) toast.error(res.error);
      else toast.success("Marked collected.");
      setConfirming(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button className="gap-2" onClick={() => setConfirming(true)}>
        <HandCoins className="size-4" /> Hand the kit over
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">Kit handed to the family?</span>
      <Button onClick={collect} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        Yes, mark collected
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
        Cancel
      </Button>
    </div>
  );
}
