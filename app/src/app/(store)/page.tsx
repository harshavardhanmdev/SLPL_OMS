export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgePercent,
  BookOpen,
  FlaskConical,
  GraduationCap,
  Landmark,
  Layers,
  Radio,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/store/product-card";
import { ProductRail } from "@/components/store/product-rail";
import InfiniteBookMenu from "@/components/store/infinite-book-menu";
import { db } from "@/lib/db";
import { getHomeData } from "@/lib/catalog";
import { site } from "@/lib/site";

export default async function HomePage() {
  const { newReleases, categories, bundleProducts, services, sale } = await getHomeData();
  // Every visible product with a cover feeds the dome, so books added in the
  // admin panel show up here automatically.
  const domeProducts = await db.product.findMany({
    where: { isVisible: true, coverImage: { not: null } },
    select: { slug: true, title: true, coverImage: true },
    orderBy: { updatedAt: "desc" },
    take: 48,
  });
  const menuItems = domeProducts.map((p) => ({
    image: p.coverImage!,
    title: p.title,
    href: `/product/${p.slug}`,
  }));

  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6">
      {/* Festival sale banner (admin-scheduled) */}
      {sale && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-saffron/20 via-saffron/10 to-saffron/20 px-4 py-2.5 text-center text-sm font-medium ring-1 ring-saffron/40">
          <BadgePercent className="size-4 shrink-0 text-saffron-deep" />
          <span>{sale.bannerText}</span>
        </div>
      )}

      {/* Hero: products front and center, copy kept subtle. */}
      <section className="relative mt-4 overflow-hidden rounded-3xl bg-[color:var(--dome-overlay)] ring-1 ring-border">
        <div className="relative grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[0.8fr_1.2fr] lg:py-6 lg:pl-14 lg:pr-4">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-4 py-1.5 text-xs font-medium backdrop-blur">
              <Sparkles className="size-3.5 text-saffron-deep" />
              {site.company}
            </span>
            <p className="font-heading text-lg font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Nursery to Civils, <span className="text-saffron-deep">one store.</span>
            </p>
            <p className="max-w-md text-pretty text-sm text-muted-foreground sm:text-base">
              Research-oriented textbooks for every grade, complete class
              bundles, novels and a UPSC Civils foundation, delivered anywhere
              in India.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="gap-2" asChild>
                <Link href="/categories">
                  Shop books <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 border-saffron/60" asChild>
                <Link href="/bundles">
                  <Layers className="size-4 text-saffron-deep" /> Class bundles
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="size-4 text-saffron-deep" /> Nursery → Grade 12
              </span>
              <span className="flex items-center gap-1.5">
                <FlaskConical className="size-4 text-saffron-deep" /> Research-first material
              </span>
              <span className="flex items-center gap-1.5">
                <Landmark className="size-4 text-saffron-deep" /> UPSC Civils
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="size-4 text-saffron-deep" /> Pan-India delivery
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-saffron-deep" /> Secure payments
              </span>
            </div>
          </div>

          {/* Desktop: draggable book sphere; snaps to a book, tap opens it. */}
          <div className="relative hidden h-[540px] w-full lg:block xl:h-[600px]">
            {menuItems.length > 0 && <InfiniteBookMenu items={menuItems} />}
          </div>

          {/* Mobile: two clickable covers per row. */}
          <div className="grid grid-cols-2 gap-3 lg:hidden">
            {menuItems.slice(0, 6).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-transform active:scale-[0.98]"
              >
                <span className="relative block aspect-[3/4]">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="45vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </span>
                <span className="line-clamp-1 block px-2.5 py-2 text-xs font-medium">{item.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* New releases - horizontally scrollable */}
      {newReleases.length > 0 && (
        <section className="mt-14">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">New releases</h2>
              <p className="text-sm text-muted-foreground">Fresh off the SLPL press</p>
            </div>
            <Button variant="ghost" className="gap-1.5" asChild>
              <Link href="/search?q=">
                View all <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <ProductRail>
            {newReleases.map((p) => (
              <ProductCard key={p.id} product={p} sale={sale} />
            ))}
          </ProductRail>
        </section>
      )}

      {/* Shop by class */}
      <section className="mt-14">
        <h2 className="mb-5 font-heading text-2xl font-bold sm:text-3xl">Shop by class</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {categories
            .filter((c) => c._count.products > 0)
            .map((cat) => (
              <Link
                key={cat.id}
                href={cat.slug === "bundles" ? "/bundles" : `/category/${cat.slug}`}
                className="group rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-saffron/60 hover:shadow-lg sm:p-6"
              >
                <div className="mb-3 inline-flex rounded-xl bg-accent p-2.5 text-saffron-deep transition-transform group-hover:scale-110">
                  {cat.slug === "bundles" ? <Layers className="size-6" /> : <BookOpen className="size-6" />}
                </div>
                <h3 className="font-heading font-semibold sm:text-lg">{cat.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{cat.description}</p>
                <p className="mt-2 text-xs font-medium text-saffron-deep">
                  {cat._count.products} {cat._count.products === 1 ? "title" : "titles"}
                </p>
              </Link>
            ))}
        </div>
      </section>

      {/* Bundles strip */}
      {bundleProducts.length > 0 && (
        <section className="mt-14 rounded-3xl bg-secondary/60 p-6 ring-1 ring-border dark:bg-card sm:p-8">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">Complete class kits</h2>
              <p className="text-sm text-muted-foreground">
                Every book for the year in one box - at a bundled price
              </p>
            </div>
            <Button variant="ghost" className="gap-1.5" asChild>
              <Link href="/bundles">
                All bundles <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {bundleProducts.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} sale={sale} />
            ))}
          </div>
        </section>
      )}

      {/* Services showcase */}
      {services.length > 0 && (
        <section className="mt-14">
          <div className="mb-5">
            <h2 className="font-heading text-2xl font-bold sm:text-3xl">Beyond books</h2>
            <p className="text-sm text-muted-foreground">
              The SLPL academic ecosystem for partner schools
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {services.map((s) => (
              <a
                key={s.id}
                href={s.externalUrl ?? site.links.main}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                {s.bannerImage ? (
                  <div className="relative aspect-[2/1] overflow-hidden bg-muted">
                    <Image
                      src={s.bannerImage}
                      alt={s.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[2/1] items-center justify-center bg-gradient-to-br from-primary to-navy p-6 dark:from-card dark:to-secondary">
                    <Radio className="size-12 text-saffron" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-heading font-semibold sm:text-lg">{s.title}</h3>
                    <Badge variant="secondary" className="shrink-0">
                      Learn more
                    </Badge>
                  </div>
                  {s.tagline && <p className="mt-1 text-sm font-medium text-saffron-deep">{s.tagline}</p>}
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="h-16" />
    </div>
  );
}
