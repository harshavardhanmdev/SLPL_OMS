"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateChallanTransport } from "@/lib/challan-actions";

/** Fills in the vehicle once it turns up at the warehouse. */
export function ChallanTransport({
  id,
  transporter,
  vehicleNumber,
}: {
  id: string;
  transporter: string;
  vehicleNumber: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState({ transporter, vehicleNumber });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await updateChallanTransport({ id, ...v });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Transport details saved.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-4">
      <p className="mb-3 text-sm text-muted-foreground">
        The goods on a raised challan are fixed. Only who is carrying them can change.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="ct-transporter">Transporter</Label>
          <Input
            id="ct-transporter"
            value={v.transporter}
            onChange={(e) => setV((old) => ({ ...old, transporter: e.target.value }))}
            className="h-11"
          />
        </div>
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="ct-vehicle">Vehicle number</Label>
          <Input
            id="ct-vehicle"
            value={v.vehicleNumber}
            onChange={(e) => setV((old) => ({ ...old, vehicleNumber: e.target.value }))}
            className="h-11 uppercase"
            placeholder="TS 09 AB 1234"
          />
        </div>
        <Button type="submit" disabled={busy} className="h-11 gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save
        </Button>
      </div>
    </form>
  );
}
