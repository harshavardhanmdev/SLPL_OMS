export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Monitor } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "My library" };

export default async function LibraryPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/library");

  const licences = await db.digitalEntitlement.findMany({
    where: { userId: session.uid },
    include: { product: { select: { slug: true, title: true, coverImage: true, pageCount: true } } },
    orderBy: { grantedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-1 font-heading text-2xl font-bold">My library</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Digital editions you have bought. They open in your browser on any device you sign in on,
        and they do not expire.
      </p>

      {licences.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing here yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Digital editions of The GenZ Times cost less than the printed copy and arrive the moment
            you pay.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/category/magazine">Browse the magazine</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {licences.map((l) => (
            <li key={l.id} className="flex gap-4 rounded-2xl border bg-card p-4">
              {l.product.coverImage && (
                <Image
                  src={l.product.coverImage}
                  alt=""
                  width={78}
                  height={104}
                  className="h-26 w-[78px] shrink-0 rounded-lg border object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-heading font-semibold">{l.product.title}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{l.code}</p>
                {l.revokedAt ? (
                  <>
                    <Badge className="mt-2 bg-muted text-muted-foreground">Access withdrawn</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Write to us if you think this is a mistake.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {l.product.pageCount ?? 0} pages
                      {l.lastViewedAt
                        ? ` · last opened ${l.lastViewedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                        : " · not opened yet"}
                    </p>
                    <Button size="sm" className="mt-3 gap-1.5" asChild>
                      <Link href={`/read/${l.product.slug}`}>
                        <Monitor className="size-3.5" /> Read
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
