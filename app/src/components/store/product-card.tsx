import Link from "next/link";
import Image from "next/image";
import { BookOpen, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/store/price";
import { AddToCartButton } from "@/components/store/add-to-cart-button";
import { effectivePrice, type ActiveSale, type PricedProduct } from "@/lib/pricing";

export type ProductCardData = PricedProduct & {
  id: string;
  slug: string;
  title: string;
  kind: "BOOK" | "NOVEL" | "POEMS" | "BUNDLE";
  series: string | null;
  gradeLabel: string | null;
  stock: number;
  coverImage: string | null;
  isNewRelease: boolean;
};

export function ProductCard({
  product,
  sale,
  className,
}: {
  product: ProductCardData;
  sale: ActiveSale;
  className?: string;
}) {
  const price = effectivePrice(product, sale);
  const out = product.stock <= 0;

  return (
    <div
      className={
        "group relative flex w-full flex-col overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:border-saffron/60 hover:shadow-lg " +
        (className ?? "")
      }
    >
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[3/4] overflow-hidden bg-muted"
        aria-label={product.title}
      >
        {product.coverImage ? (
          <Image
            src={product.coverImage}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="size-10 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1.5">
          {product.isNewRelease && (
            <Badge className="bg-saffron text-navy shadow-sm">New</Badge>
          )}
          {product.kind === "BUNDLE" && (
            <Badge variant="secondary" className="gap-1 shadow-sm">
              <Layers className="size-3" /> Bundle
            </Badge>
          )}
          {price < product.price && (
            <Badge className="bg-green-600 text-white shadow-sm">Sale</Badge>
          )}
        </div>
        {out && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <span className="rounded-full border bg-card px-3 py-1 text-sm font-medium">Out of stock</span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {(product.series || product.gradeLabel) && (
          <p className="text-xs font-medium text-saffron-deep">
            {[product.series, product.gradeLabel].filter(Boolean).join(" · ")}
          </p>
        )}
        <Link href={`/product/${product.slug}`} className="line-clamp-2 font-medium leading-snug hover:underline">
          {product.title}
        </Link>
        <div className="mt-auto space-y-2.5">
          <Price amount={price} mrp={product.mrp} size="sm" />
          <AddToCartButton
            size="sm"
            className="w-full"
            disabled={out}
            product={{
              productId: product.id,
              slug: product.slug,
              title: product.title,
              unitPrice: price,
              image: product.coverImage,
            }}
          />
        </div>
      </div>
    </div>
  );
}
