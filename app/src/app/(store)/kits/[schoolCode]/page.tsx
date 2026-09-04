export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";

import { KitPurchaseForm } from "@/components/store/kit-purchase-form";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { currentAcademicYear } from "@/lib/kits";
import { formatINR } from "@/lib/money";
import { effectivePrice } from "@/lib/pricing";
import { getActiveSale } from "@/lib/catalog";

type Props = { params: Promise<{ schoolCode: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolCode } = await params;
  const school = await db.school.findFirst({
    where: { code: schoolCode.toUpperCase(), isActive: true },
    select: { name: true, city: true },
  });
  if (!school) return { title: "School kits" };
  return {
    title: `${school.name} kits`,
    description: `Pay online for the ${school.name} school kit and collect it at the school in ${school.city}.`,
  };
}

export default async function SchoolKitsPage({ params }: Props) {
  const { schoolCode } = await params;
  const year = currentAcademicYear();

  const school = await db.school.findFirst({
    where: { code: schoolCode.toUpperCase(), isActive: true },
    include: {
      kits: {
        where: { isActive: true, academicYear: year },
        include: {
          product: {
            include: {
              bundleItems: {
                include: { product: { select: { title: true, coverImage: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!school) notFound();

  const [session, sale] = await Promise.all([getSession(), getActiveSale()]);
  const kits = school.kits
    .filter((k) => k.product.isVisible)
    .sort((a, b) => a.classLabel.localeCompare(b.classLabel, "en", { numeric: true }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/kits"
        className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All schools
      </Link>

      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold">{school.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5" /> {school.city}, {school.state} · Academic year {year}
        </p>
      </header>

      {kits.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="font-medium">No kits are open for {year} at this school yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Please check back closer to the term.</p>
        </div>
      ) : (
        <ul className="space-y-6">
          {kits.map((kit) => {
            const price = effectivePrice(kit.product, sale);
            const soldOut = kit.product.stock <= 0;
            return (
              <li key={kit.id} className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b p-5">
                  <div>
                    <h2 className="font-heading text-xl font-semibold">{kit.classLabel}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">{kit.product.title}</p>
                    {kit.collectionNote && (
                      <p className="mt-2 text-sm text-muted-foreground">{kit.collectionNote}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-2xl font-bold">{formatINR(price)}</p>
                    {price < kit.product.mrp && (
                      <p className="text-sm text-muted-foreground line-through">
                        {formatINR(kit.product.mrp)}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {soldOut ? "Out of stock" : `${kit.product.stock} available`}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="mb-3 text-sm font-semibold">
                    What is inside ({kit.product.bundleItems.length} items)
                  </h3>
                  <ul className="mb-6 grid gap-2 sm:grid-cols-2">
                    {kit.product.bundleItems.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 text-sm">
                        {item.product.coverImage ? (
                          <Image
                            src={item.product.coverImage}
                            alt=""
                            width={28}
                            height={38}
                            className="h-9 w-7 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <span className="h-9 w-7 shrink-0 rounded bg-muted" />
                        )}
                        <span className="min-w-0">
                          {item.product.title}
                          {item.quantity > 1 && (
                            <span className="text-muted-foreground"> × {item.quantity}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {soldOut ? (
                    <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                      This kit is out of stock. Please ask the school office.
                    </p>
                  ) : session ? (
                    <KitPurchaseForm
                      schoolKitId={kit.id}
                      classLabel={kit.classLabel}
                      amount={price}
                    />
                  ) : (
                    <p className="rounded-xl border border-dashed p-4 text-center text-sm">
                      <Link
                        href={`/login?next=/kits/${school.code}`}
                        className="font-medium hover:underline"
                      >
                        Log in
                      </Link>{" "}
                      to pay for this kit.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
