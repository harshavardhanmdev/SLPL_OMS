"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cartStore, cartSubtotal, useCart } from "@/lib/cart-store";
import { formatINR } from "@/lib/money";

export default function CartPage() {
  const cart = useCart();
  const subtotal = cartSubtotal(cart);

  if (cart.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
        <div className="rounded-full bg-accent p-5 text-saffron-deep">
          <ShoppingCart className="size-8" />
        </div>
        <h1 className="font-heading text-2xl font-bold">Your cart is empty</h1>
        <p className="text-muted-foreground">
          Browse the catalog and add books - they will wait for you here.
        </p>
        <Button size="lg" asChild>
          <Link href="/categories">Start shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-heading text-3xl font-bold">
        Your cart <span className="text-base font-normal text-muted-foreground">({cart.length} {cart.length === 1 ? "item" : "items"})</span>
      </h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-3">
          {cart.map((line) => (
            <li key={line.productId} className="flex gap-4 rounded-xl border bg-card p-3 sm:p-4">
              <Link href={`/product/${line.slug}`} className="relative block h-28 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
                {line.image ? (
                  <Image src={line.image} alt={line.title} fill sizes="80px" className="object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center">
                    <BookOpen className="size-6 text-muted-foreground/40" />
                  </span>
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/product/${line.slug}`} className="line-clamp-2 font-medium hover:underline">
                  {line.title}
                </Link>
                <p className="mt-0.5 text-sm text-muted-foreground">{formatINR(line.unitPrice)} each</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <div className="flex items-center rounded-full border">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full"
                      aria-label="Decrease quantity"
                      onClick={() => cartStore.setQuantity(line.productId, line.quantity - 1)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{line.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full"
                      aria-label="Increase quantity"
                      onClick={() => cartStore.setQuantity(line.productId, line.quantity + 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-heading font-semibold">{formatINR(line.unitPrice * line.quantity)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${line.title}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => cartStore.remove(line.productId)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-20">
          <h2 className="font-heading text-lg font-semibold">Order summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping & discounts</span>
              <span>at checkout</span>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex justify-between font-heading text-lg font-bold">
            <span>Total</span>
            <span>{formatINR(subtotal)}</span>
          </div>
          <Button size="lg" className="mt-5 w-full" asChild>
            <Link href="/checkout">Proceed to checkout</Link>
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Prices are confirmed against the live catalog at checkout.
          </p>
        </aside>
      </div>
    </div>
  );
}
