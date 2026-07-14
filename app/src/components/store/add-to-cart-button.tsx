"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cartStore } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

type ProductInput = {
  productId: string;
  slug: string;
  title: string;
  unitPrice: number;
  image: string | null;
};

export function AddToCartButton({
  product,
  quantity = 1,
  disabled,
  size = "default",
  className,
}: {
  product: ProductInput;
  quantity?: number;
  disabled?: boolean;
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const [added, setAdded] = React.useState(false);

  function add() {
    cartStore.add(product, quantity);
    setAdded(true);
    toast.success(`Added “${product.title}” to cart`);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Button size={size} disabled={disabled} onClick={add} className={cn("gap-2", className)}>
      {added ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
      {disabled ? "Out of stock" : added ? "Added" : "Add to cart"}
    </Button>
  );
}

export function BuyNowButton({
  product,
  quantity = 1,
  disabled,
  className,
}: {
  product: ProductInput;
  quantity?: number;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  return (
    <Button
      size="lg"
      variant="secondary"
      disabled={disabled}
      className={cn("gap-2 border border-saffron bg-saffron/10 text-foreground hover:bg-saffron/20", className)}
      onClick={() => {
        cartStore.add(product, quantity);
        router.push("/cart");
      }}
    >
      <Zap className="size-4 text-saffron-deep" /> Buy now
    </Button>
  );
}
