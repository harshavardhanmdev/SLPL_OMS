"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCheck, Loader2, PackageCheck, Send, Truck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  orderCancel,
  orderDelivered,
  orderMarkPaidManually,
  orderMarkProcessing,
  orderOutForDelivery,
  orderShip,
} from "@/lib/admin-actions";

export function OrderActions({ orderNumber, status }: { orderNumber: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [shipOpen, setShipOpen] = React.useState(false);
  const [ship, setShip] = React.useState({ courierName: "", awb: "", trackingUrl: "", etaDays: "" });

  async function run(name: string, fn: () => Promise<{ ok?: boolean; error?: string }>) {
    setBusy(name);
    try {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else {
        toast.success("Done");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const btn = (name: string, label: string, icon: React.ReactNode, fn: () => Promise<{ ok?: boolean; error?: string }>, variant: "default" | "outline" = "default") => (
    <Button
      key={name}
      variant={variant}
      size="sm"
      className="gap-1.5"
      disabled={busy !== null}
      onClick={() => run(name, fn)}
    >
      {busy === name ? <Loader2 className="size-4 animate-spin" /> : icon}
      {label}
    </Button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {status === "AWAITING_PAYMENT" &&
        btn("paid", "Mark paid (manual)", <CheckCheck className="size-4" />, () => orderMarkPaidManually(orderNumber), "outline")}

      {["PAID", "CONFIRMED"].includes(status) &&
        btn("processing", "Start packing", <PackageCheck className="size-4" />, () => orderMarkProcessing(orderNumber))}

      {["PAID", "CONFIRMED", "PROCESSING"].includes(status) && (
        <Dialog open={shipOpen} onOpenChange={setShipOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Send className="size-4" /> Ship order
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ship #{orderNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Courier name</Label>
                <Input
                  placeholder="e.g. BlueDart / Delhivery"
                  value={ship.courierName}
                  onChange={(e) => setShip({ ...ship, courierName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>AWB / tracking number</Label>
                <Input value={ship.awb} onChange={(e) => setShip({ ...ship, awb: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tracking URL (customer will get this link)</Label>
                <Input
                  placeholder="https://…"
                  value={ship.trackingUrl}
                  onChange={(e) => setShip({ ...ship, trackingUrl: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ETA days (optional)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={ship.etaDays}
                  onChange={(e) => setShip({ ...ship, etaDays: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="gap-1.5"
                disabled={busy !== null || !ship.courierName || !ship.awb}
                onClick={() =>
                  run("ship", async () => {
                    const res = await orderShip(orderNumber, {
                      courierName: ship.courierName,
                      awb: ship.awb,
                      trackingUrl: ship.trackingUrl,
                      etaDays: ship.etaDays ? Number(ship.etaDays) : null,
                    });
                    if (!res.error) setShipOpen(false);
                    return res;
                  })
                }
              >
                {busy === "ship" ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
                Confirm shipped + email customer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {status === "SHIPPED" &&
        btn("ofd", "Out for delivery", <Truck className="size-4" />, () => orderOutForDelivery(orderNumber))}

      {["SHIPPED", "OUT_FOR_DELIVERY"].includes(status) &&
        btn("delivered", "Mark delivered", <CheckCheck className="size-4" />, () => orderDelivered(orderNumber))}

      {["AWAITING_PAYMENT", "COD_PENDING_OTP", "PAID", "CONFIRMED", "PROCESSING"].includes(status) &&
        btn(
          "cancel",
          "Cancel order",
          <Ban className="size-4" />,
          async () => {
            if (!confirm("Cancel this order? Stock is restored and any captured payment is refunded.")) {
              return {};
            }
            return orderCancel(orderNumber);
          },
          "outline",
        )}
    </div>
  );
}
