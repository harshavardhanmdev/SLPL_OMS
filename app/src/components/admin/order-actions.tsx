"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Ban, CheckCheck, Loader2, PackageCheck, ScanText, Send, Truck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadButton } from "@/components/admin/upload-button";
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
  orderShipViaShiprocket,
} from "@/lib/admin-actions";

/** Pull a courier consignment number out of OCR text (DTDC style first: one letter + 8-9 digits). */
function extractAwb(text: string): string | null {
  const compact = text.replace(/[\s ]+/g, " ");
  const dtdc = compact.match(/\b[A-Z]\d{8,9}\b/);
  if (dtdc) return dtdc[0];
  const digits = compact.match(/\b\d{9,14}\b/);
  return digits ? digits[0] : null;
}

export function OrderActions({
  orderNumber,
  status,
  shiprocketEnabled = false,
  trackingUrlDefault = "",
  compact = false,
}: {
  orderNumber: string;
  status: string;
  shiprocketEnabled?: boolean;
  trackingUrlDefault?: string;
  /** Row mode for the Shipments board: only the stage-advancing buttons. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [shipOpen, setShipOpen] = React.useState(false);
  const [ship, setShip] = React.useState({
    courierName: "DTDC",
    awb: "",
    trackingUrl: trackingUrlDefault,
    etaDays: "",
    trackingPhotoUrl: "",
  });
  const [ocr, setOcr] = React.useState<"idle" | "reading" | "found" | "none">("idle");

  async function readAwbFromPhoto(url: string) {
    setOcr("reading");
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const result = await Tesseract.recognize(url, "eng");
      const awb = extractAwb(result.data.text ?? "");
      if (awb) {
        setShip((s) => (s.awb ? s : { ...s, awb }));
        setOcr("found");
        toast.success(`Read ${awb} from the photo - please verify`);
      } else {
        setOcr("none");
      }
    } catch {
      setOcr("none");
    }
  }

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
        !compact &&
        btn("paid", "Mark paid (manual)", <CheckCheck className="size-4" />, () => orderMarkPaidManually(orderNumber), "outline")}

      {["PAID", "CONFIRMED"].includes(status) &&
        btn("processing", "Start packing", <PackageCheck className="size-4" />, () => orderMarkProcessing(orderNumber))}

      {["PAID", "CONFIRMED", "PROCESSING"].includes(status) &&
        shiprocketEnabled &&
        !compact &&
        btn("shiprocket", "Ship via Shiprocket (auto AWB)", <Send className="size-4" />, () =>
          orderShipViaShiprocket(orderNumber),
        )}

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
                  placeholder="e.g. DTDC / BlueDart"
                  value={ship.courierName}
                  onChange={(e) => setShip({ ...ship, courierName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Receipt photo (optional - reads the number for you)</Label>
                <div className="flex items-center gap-3">
                  <UploadButton
                    kind="receipt"
                    label={ship.trackingPhotoUrl ? "Replace photo" : "Upload photo"}
                    onUploaded={(url) => {
                      setShip((s) => ({ ...s, trackingPhotoUrl: url }));
                      void readAwbFromPhoto(url);
                    }}
                  />
                  {ship.trackingPhotoUrl && (
                    <Image
                      src={ship.trackingPhotoUrl}
                      alt="Courier receipt"
                      width={56}
                      height={56}
                      unoptimized
                      className="size-14 rounded-md border object-cover"
                    />
                  )}
                  {ocr === "reading" && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> Reading number…
                    </span>
                  )}
                  {ocr === "none" && (
                    <span className="text-xs text-muted-foreground">
                      Could not read a number - type it below.
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  AWB / consignment number
                  {ocr === "found" && (
                    <span className="flex items-center gap-1 text-xs font-normal text-saffron-deep">
                      <ScanText className="size-3.5" /> read from photo - please verify
                    </span>
                  )}
                </Label>
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
                      trackingPhotoUrl: ship.trackingPhotoUrl,
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
        !compact &&
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
