"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelMyOrder } from "@/lib/account-actions";

export function CancelOrder({ orderNumber, paid }: { orderNumber: string; paid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await cancelMyOrder(orderNumber);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2 text-destructive hover:text-destructive">
          <XCircle className="size-4" /> Cancel order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel order #{orderNumber}?</DialogTitle>
          <DialogDescription>
            {paid
              ? "Your payment will be refunded automatically and should reach your account in 5-7 working days."
              : "This order will be cancelled and the items released back to stock."}
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Keep order
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy ? "Cancelling…" : "Yes, cancel it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
