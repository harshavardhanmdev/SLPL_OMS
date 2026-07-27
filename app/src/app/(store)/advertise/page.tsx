export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Newspaper,
  QrCode,
  Sparkles,
  Star,
  Target,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Advertise in The GenZ Times",
  description:
    "Reach students, parents, teachers and school leaders across India. Advertising opportunities in The GenZ Times, the monthly education and youth magazine from Saaradaa Learknowations.",
  keywords: [
    "advertise in education magazine India",
    "school magazine advertising",
    "student magazine ad rates",
    "education advertising Hyderabad",
    "EdTech advertising",
    "The GenZ Times media kit",
  ],
};

const WHY = [
  { icon: Target, title: "Targeted education audience", body: "Every reader is a student, parent, teacher or school decision maker. No wasted impressions." },
  { icon: Newspaper, title: "Premium editorial environment", body: "Your brand sits beside considered writing on careers, technology and learning, not clickbait." },
  { icon: Users, title: "High reader engagement", body: "A magazine people sit with, not scroll past. Long-form attention is the whole point." },
  { icon: CalendarDays, title: "Long shelf life", body: "Copies stay in school libraries, staff rooms and homes for months after the issue date." },
  { icon: BookOpen, title: "Print and digital visibility", body: "Every advertisement runs in the printed issue and the digital edition." },
  { icon: QrCode, title: "QR code integration", body: "Send readers straight to your admissions page, app or campaign with a scannable code." },
  { icon: BadgeCheck, title: "Trusted educational brand", body: "Published by Saaradaa Learknowations, already working inside schools across Telangana and Andhra Pradesh." },
];

const PRIMARY_READERS = [
  "School students, Grades 6 to 12",
  "College students",
  "Parents",
  "Teachers",
  "School principals",
  "Educational institutions",
];

const SECONDARY_READERS = [
  "Universities",
  "Coaching institutes",
  "EdTech companies",
  "Publishers",
  "Educational NGOs",
  "Corporate CSR teams",
  "Government education departments",
  "Career counsellors",
];

const PLACEMENTS = [
  { name: "Back cover", note: "The most visible page in the magazine" },
  { name: "Inside front and inside back cover", note: "Premium positions, first and last impression" },
  { name: "Full page", note: "Full-bleed advertisement inside the issue" },
  { name: "Half page", note: "Horizontal or vertical" },
  { name: "Advertorial feature", note: "Your story told in the magazine's editorial voice" },
  { name: "Series bookings", note: "Three, six or twelve issues at a preferential rate" },
];

export default async function AdvertisePage() {
  const magazine = await db.product.findFirst({
    where: { slug: "genz-times-issue-01", isVisible: true },
    select: { slug: true, title: true, coverImage: true },
  });

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-navy text-white ring-1 ring-border">
        <div className="grid items-center gap-8 p-8 sm:p-10 lg:grid-cols-[260px_1fr] lg:p-12">
          {magazine?.coverImage && (
            <Link
              href={`/product/${magazine.slug}`}
              className="mx-auto block w-48 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/20 transition-transform hover:scale-[1.03] lg:mx-0 lg:w-full"
            >
              <Image
                src={magazine.coverImage}
                alt={magazine.title}
                width={260}
                height={334}
                className="w-full object-cover"
              />
            </Link>
          )}
          <div className="space-y-4 text-center lg:text-left">
            <Badge className="bg-saffron text-navy">Media Kit 2026-27</Badge>
            <h1 className="text-balance font-heading text-3xl font-bold sm:text-4xl lg:text-5xl">
              Advertise in The GenZ Times
            </h1>
            <p className="mx-auto max-w-2xl text-pretty text-white/80 sm:text-lg lg:mx-0">
              Where young minds meet great opportunities. A premium monthly education and youth
              magazine that puts your organisation in front of the students, parents, teachers and
              principals who make education decisions.
            </p>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button size="lg" className="gap-2 bg-saffron text-navy hover:bg-saffron-deep" asChild>
                <a href={site.links.advertiseForm} target="_blank" rel="noreferrer">
                  Advertise with us <Sparkles className="size-4" />
                </a>
              </Button>
              {magazine && (
                <Button size="lg" variant="outline" className="gap-2 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
                  <Link href={`/product/${magazine.slug}`}>
                    <BookOpen className="size-4" /> Read Issue 01
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-heading text-2xl font-bold">About the magazine</h2>
          <div className="mt-3 space-y-4 leading-relaxed text-muted-foreground">
            <p>
              The GenZ Times is a premium monthly education and youth magazine published by{" "}
              {site.company}. It inspires students, educators, parents and institutions through
              high-quality writing on education, technology, careers, innovation, entrepreneurship,
              science, leadership, public policy, mental wellness and future-ready skills.
            </p>
            <p>
              Every issue combines insightful editorial with meaningful opportunities for
              organisations to connect with India&apos;s next generation of learners. Issue 01
              launched in August 2026 with sixty-four pages on artificial intelligence in the
              classroom, the careers taking shape around this generation and the young change makers
              already at work.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5">
            <Users className="mb-2 size-5 text-saffron-deep" />
            <h3 className="font-heading font-semibold">Primary readers</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {PRIMARY_READERS.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <Building2 className="mb-2 size-5 text-saffron-deep" />
            <h3 className="font-heading font-semibold">Also reaching</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {SECONDARY_READERS.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Why advertise */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">Why advertise with us</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border bg-card p-5">
              <Icon className="mb-2 size-5 text-saffron-deep" />
              <h3 className="font-heading font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Placements */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">Placements available</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Rates depend on placement and how many issues you book. Request the rate card below and we
          will send current pricing with the artwork specifications.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLACEMENTS.map((p) => (
            <div key={p.name} className="rounded-xl border bg-card p-4">
              <p className="font-heading font-semibold">{p.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{p.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Founding advertiser */}
      <section className="mt-12 overflow-hidden rounded-3xl bg-gradient-to-br from-saffron/20 via-accent to-saffron/10 p-8 ring-1 ring-saffron/40 sm:p-10">
        <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Badge className="mb-3 gap-1.5 bg-navy text-white">
              <Star className="size-3.5 fill-saffron text-saffron" /> First year only
            </Badge>
            <h2 className="font-heading text-2xl font-bold">Founding Advertiser Programme</h2>
            <p className="mt-2 text-muted-foreground">
              Partners who join in our first year are recognised as Founding Partners of The GenZ
              Times, with benefits that continue as the magazine grows.
            </p>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-saffron-deep" /> Locked-in pricing for twelve months
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-saffron-deep" /> Priority placement in every issue
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-saffron-deep" /> First right of renewal before space opens to others
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-saffron-deep" /> Recognition as a Founding Partner
              </li>
            </ul>
          </div>
          <Button size="lg" className="gap-2" asChild>
            <a href={site.links.advertiseForm} target="_blank" rel="noreferrer">
              Enquire now <GraduationCap className="size-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* Enquiry: the Zoho form is the single place advertiser details land */}
      <section id="enquire" className="mt-12 grid scroll-mt-24 gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center rounded-2xl border-2 border-saffron/50 bg-card p-8">
          <h2 className="font-heading text-2xl font-bold">Send us your details</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Fill in our advertising form and our team will send you the current rate card,
            available placements and artwork specifications, usually within one working day.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-saffron-deep" /> Takes about two minutes
            </li>
            <li className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-saffron-deep" /> No obligation, we simply send the rates
            </li>
            <li className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-saffron-deep" /> Founding Advertiser pricing while it lasts
            </li>
          </ul>
          <Button size="lg" className="mt-6 w-full gap-2" asChild>
            <a href={site.links.advertiseForm} target="_blank" rel="noreferrer">
              Open the advertising form <ExternalLink className="size-4" />
            </a>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Opens our secure Zoho form in a new tab.
          </p>
        </div>
        <div className="space-y-4 rounded-2xl border bg-secondary/60 p-6 dark:bg-card">
          <h2 className="font-heading text-xl font-bold">Prefer to talk?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Our team can walk you through placements, artwork specifications and issue deadlines,
            and put together a plan that fits your budget.
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Phone:</span>{" "}
            <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`} className="font-medium hover:underline">
              {site.contact.phone}
            </a>
            <br />
            <span className="text-muted-foreground">Email:</span>{" "}
            <a href={`mailto:${site.contact.email}`} className="font-medium hover:underline">
              {site.contact.email}
            </a>
            <br />
            <span className="text-muted-foreground">Editorial:</span>{" "}
            <a href="mailto:editor@saaradaa.com" className="font-medium hover:underline">
              editor@saaradaa.com
            </a>
          </p>
          <p className="text-sm text-muted-foreground">
            {site.company}
            <br />
            {site.contact.address}
          </p>
          <Button variant="outline" className="w-full gap-2" asChild>
            <a href={site.contact.whatsapp} target="_blank" rel="noreferrer">
              Message us on WhatsApp
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
