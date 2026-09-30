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
        <ul className="space-y-5">
          {licences.map((l) => {
            const opened = l.lastViewedAt
              ? `Last opened ${l.lastViewedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
              : "Not opened yet";

            // The whole card is the way in. Having to find a small button was
            // the first thing the owner tripped over.
            const inside = (
              <>
                {l.product.coverImage && (
                  <Image
                    src={l.product.coverImage}
                    alt=""
                    width={150}
                    height={200}
                    className="w-[110px] shrink-0 rounded-xl border object-cover shadow-sm sm:w-[150px]"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-lg font-semibold sm:text-xl">{l.product.title}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{l.code}</p>
                  {l.revokedAt ? (
                    <>
                      <Badge className="mt-3 bg-muted text-muted-foreground">Access withdrawn</Badge>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Write to us if you think this is a mistake.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {l.product.pageCount ?? 0} pages · {opened}
                      </p>
                      <span className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 font-medium text-primary-foreground transition group-hover:brightness-110">
                        <Monitor className="size-4" /> Read now
                      </span>
                    </>
                  )}
                </div>
              </>
            );

            return (
              <li key={l.id}>
                {l.revokedAt ? (
                  <div className="flex gap-5 rounded-2xl border bg-card p-5">{inside}</div>
                ) : (
                  <Link
                    href={`/read/${l.product.slug}`}
                    className="group flex gap-5 rounded-2xl border bg-card p-5 transition hover:border-saffron hover:shadow-lg"
                  >
                    {inside}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
