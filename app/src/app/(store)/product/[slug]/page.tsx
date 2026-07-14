import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, Layers, PackageCheck, ShieldCheck, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AddToCartButton, BuyNowButton } from "@/components/store/add-to-cart-button";
import { DeliveryEstimate } from "@/components/store/delivery-estimate";
import { PdfPreview } from "@/components/store/pdf-preview";
import { Price } from "@/components/store/price";
import { formatINR } from "@/lib/money";
import { getActiveSale, getProductBySlug } from "@/lib/catalog";
import { effectivePrice } from "@/lib/pricing";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return {
    title: product?.title ?? "Book",
    description: product?.description.slice(0, 160),
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, sale] = await Promise.all([getProductBySlug(slug), getActiveSale()]);
  if (!product) notFound();

  const price = effectivePrice(product, sale);
  const out = product.stock <= 0;
  const memberTotal = product.bundleItems.reduce(
    (sum, item) => sum + effectivePrice(item.product, sale) * item.quantity,
    0,
  );
  const bundleSavings = product.kind === "BUNDLE" && memberTotal > price ? memberTotal - price : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link
          href={product.category.slug === "bundles" ? "/bundles" : `/category/${product.category.slug}`}
          className="hover:text-foreground"
        >
          {product.category.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[420px_1fr]">
        {/* Cover */}
        <div className="mx-auto w-full max-w-sm lg:mx-0">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border bg-muted shadow-sm">
            {product.coverImage ? (
              <Image
                src={product.coverImage}
                alt={product.title}
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 420px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <BookOpen className="size-16 text-muted-foreground/40" />
              </div>
            )}
          </div>
          {product.gallery.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {product.gallery.slice(0, 4).map((src) => (
                <div key={src} className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted">
                  <Image src={src} alt="" fill sizes="100px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {product.series && <Badge variant="secondary">{product.series}</Badge>}
            {product.gradeLabel && <Badge variant="secondary">{product.gradeLabel}</Badge>}
            {product.isNewRelease && <Badge className="bg-saffron text-navy">New release</Badge>}
            {product.kind === "BUNDLE" && (
              <Badge className="gap-1 bg-primary text-primary-foreground">
                <Layers className="size-3" /> Bundle
              </Badge>
            )}
          </div>

          <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">{product.title}</h1>

          <Price amount={price} mrp={product.mrp} size="lg" />
          {bundleSavings > 0 && (
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              You save {formatINR(bundleSavings)} vs buying titles separately
            </p>
          )}

          <p className={out ? "text-sm font-medium text-destructive" : "text-sm font-medium text-green-700 dark:text-green-400"}>
            {out ? "Currently out of stock" : product.stock <= 10 ? `Only ${product.stock} left in stock` : "In stock"}
          </p>

          <div className="flex flex-wrap gap-3">
            <AddToCartButton
              size="lg"
              disabled={out}
              product={{
                productId: product.id,
                slug: product.slug,
                title: product.title,
                unitPrice: price,
                image: product.coverImage,
              }}
            />
            <BuyNowButton
              disabled={out}
              product={{
                productId: product.id,
                slug: product.slug,
                title: product.title,
                unitPrice: price,
                image: product.coverImage,
              }}
            />
            {product.samplePdf && <PdfPreview url={product.samplePdf} title={product.title} />}
          </div>

          <DeliveryEstimate weightGrams={product.weightGrams} />

          <Separator />

          <section>
            <h2 className="mb-2 font-heading text-lg font-semibold">About this {product.kind === "BUNDLE" ? "kit" : "book"}</h2>
            <p className="whitespace-pre-line text-pretty leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          </section>

          {product.bundleItems.length > 0 && (
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold">Inside this kit</h2>
              <ul className="space-y-2">
                {product.bundleItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/product/${item.product.slug}`}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-saffron/60"
                    >
                      <span className="flex items-center gap-3">
                        {item.product.coverImage && (
                          <Image
                            src={item.product.coverImage}
                            alt=""
                            width={40}
                            height={53}
                            className="rounded-md border object-cover"
                          />
                        )}
                        <span className="text-sm font-medium">
                          {item.product.title}
                          {item.quantity > 1 && <span className="text-muted-foreground"> × {item.quantity}</span>}
                        </span>
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatINR(effectivePrice(item.product, sale))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-3 rounded-xl border bg-muted/40 p-4 text-sm sm:grid-cols-3">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-saffron-deep" /> Secure payment
            </span>
            <span className="flex items-center gap-2">
              <PackageCheck className="size-4 shrink-0 text-saffron-deep" /> Carefully packed
            </span>
            <span className="flex items-center gap-2">
              <Undo2 className="size-4 shrink-0 text-saffron-deep" /> Damage replacement
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
