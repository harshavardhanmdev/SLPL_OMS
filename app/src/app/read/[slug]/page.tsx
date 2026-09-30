export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookLock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EditionReader } from "@/components/store/edition-reader";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { findLicence } from "@/lib/digital-access";

export const metadata: Metadata = { title: "Reading", robots: { index: false } };

export default async function ReadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const session = await getSession();
  if (!session) redirect(`/login?next=/read/${slug}`);

  const licence = await findLicence(session.uid, slug);
  if (licence) {
    return (
      <EditionReader slug={slug} pageCount={licence.pageCount} title={licence.title} />
    );
  }

  // Either they have not bought it, or their licence was revoked. Say so once
  // and point at the thing they can do about it.
  const product = await db.product.findFirst({
    where: { slug, kind: "DIGITAL", isVisible: true },
    select: { title: true, slug: true },
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <BookLock className="mx-auto size-10 text-muted-foreground" />
      <h1 className="mt-4 font-heading text-2xl font-bold">
        {product ? "You do not have this issue yet" : "That edition does not exist"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {product
          ? "A digital edition opens only for the account that bought it. If you paid on a different account, sign in with that one."
          : "Check the link, or browse the magazine and pick an issue."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href={product ? `/product/${product.slug}` : "/category/magazine"}>
            {product ? "See this issue" : "Browse the magazine"}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/account/library">My library</Link>
        </Button>
      </div>
    </div>
  );
}
