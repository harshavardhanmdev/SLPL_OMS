import type { Metadata } from "next";
import Link from "next/link";
import { Construction } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Checkout" };

/** Placeholder until M5 wires addresses + Razorpay. Keeps /checkout from 404ing in previews. */
export default function CheckoutPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="rounded-full bg-accent p-5 text-saffron-deep">
        <Construction className="size-8" />
      </div>
      <h1 className="font-heading text-2xl font-bold">Checkout is almost ready</h1>
      <p className="text-muted-foreground">
        Secure payments (UPI, cards, netbanking) and address selection are being
        wired up right now. Your cart is saved — come back shortly.
      </p>
      <Button variant="outline" asChild>
        <Link href="/cart">Back to cart</Link>
      </Button>
    </div>
  );
}
