export const dynamic = "force-dynamic";

import Image from "next/image";
import type { Metadata } from "next";
import { ArrowUpRight, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services",
  description:
    "The SLPL academic ecosystem - SL Radio, English communication workshops, the SJIS journal and the SL Learning Management System.",
};

export default async function ServicesPage() {
  const services = await db.servicePage.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-heading text-3xl font-bold">Beyond books</h1>
        <p className="mt-2 text-muted-foreground">
          {site.company} partners with schools across India through a
          nine-point academic ecosystem. Here are the programs schools ask us
          about the most.
        </p>
      </header>

      <div className="space-y-8">
        {services.map((s) => (
          <a
            key={s.id}
            href={s.externalUrl ?? site.links.main}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            {s.bannerImage ? (
              <div className="relative aspect-[21/9] overflow-hidden bg-muted">
                <Image
                  src={s.bannerImage}
                  alt={s.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 960px"
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.01]"
                />
              </div>
            ) : (
              <div className="flex aspect-[21/6] items-center justify-center bg-gradient-to-br from-primary to-navy dark:from-card dark:to-secondary">
                <Radio className="size-12 text-saffron" />
              </div>
            )}
            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-heading text-xl font-semibold">{s.title}</h2>
                <Badge variant="secondary" className="gap-1">
                  Visit <ArrowUpRight className="size-3.5" />
                </Badge>
              </div>
              {s.tagline && <p className="mt-1 font-medium text-saffron-deep">{s.tagline}</p>}
              <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{s.description}</p>
            </div>
          </a>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border bg-secondary/60 p-6 text-center dark:bg-card">
        <p className="font-heading text-lg font-semibold">Want any of these for your school?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Call {site.contact.person} at{" "}
          <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`} className="font-medium text-foreground underline">
            {site.contact.phone}
          </a>{" "}
          or write to{" "}
          <a href={`mailto:${site.contact.email}`} className="font-medium text-foreground underline">
            {site.contact.email}
          </a>
        </p>
      </div>
    </div>
  );
}
