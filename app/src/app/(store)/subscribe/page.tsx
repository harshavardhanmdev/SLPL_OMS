export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Check, Mail, Truck } from "lucide-react";

import { SubscribeForm } from "@/components/store/subscribe-form";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { PLANS, endIssueFor, perIssue, savingsPercent, startIssueFor } from "@/lib/subscription-plans";

export const metadata: Metadata = {
  title: "Subscribe to The GenZ Times",
  description:
    "Subscribe to The GenZ Times, the monthly education and youth magazine from Saaradaa Learknowations. Six or twelve issues delivered to your door, at up to 29% off the cover price.",
  keywords: [
    "GenZ Times subscription",
    "student magazine India",
    "education magazine subscription",
    "school magazine",
    "youth magazine India",
  ],
};

export default async function SubscribePage() {
  const start = startIssueFor();
  const [session, current] = await Promise.all([
    getSession(),
    db.product.findFirst({
      where: { isVisible: true, category: { is: { slug: "magazine" } } },
      orderBy: { createdAt: "desc" },
      select: { slug: true, title: true, coverImage: true },
    }),
  ]);

  const user = session ? await db.user.findUnique({ where: { id: session.uid } }) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-10 grid gap-8 md:grid-cols-[1fr_260px] md:items-center">
        <div>
          <p className="text-sm font-semibold text-saffron-deep">The GenZ Times</p>
          <h1 className="mt-1 font-heading text-3xl font-bold sm:text-4xl">
            Every issue, delivered to your door
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            A monthly magazine for students of Grade 6 and above, their parents and their teachers.
            Careers, technology, study skills and the ideas shaping the next generation. Subscribe
            once and each issue is posted as it prints, starting with{" "}
            <b className="text-foreground">{start.label}</b>.
          </p>
          <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
            {[
              [Truck, "Posted across India, no delivery charge"],
              [BookOpen, "Never miss an issue or hunt for a copy"],
              [Mail, "We remind you before it runs out"],
            ].map(([Icon, text]) => (
              <li key={String(text)} className="flex items-start gap-2">
                <Icon className="mt-0.5 size-4 shrink-0 text-saffron-deep" />
                <span className="text-muted-foreground">{text as string}</span>
              </li>
            ))}
          </ul>
        </div>
        {current?.coverImage && (
          <Link href={`/product/${current.slug}`} className="mx-auto w-44 md:w-full">
            <Image
              src={current.coverImage}
              alt={current.title}
              width={260}
              height={347}
              className="rounded-xl border shadow-lg"
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Current issue. Buy a single copy instead.
            </p>
          </Link>
        )}
      </header>

      <section className="mb-10">
        <h2 className="mb-4 font-heading text-xl font-semibold">Choose a term</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((plan) => {
            const end = endIssueFor(start.date, plan.issues);
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border bg-card p-5 ${
                  plan.popular ? "border-saffron shadow-sm" : ""
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-5 rounded-full bg-saffron px-3 py-0.5 text-xs font-bold text-navy">
                    Best value
                  </span>
                )}
                <p className="font-heading text-lg font-bold">{plan.label}</p>
                <p className="text-sm text-muted-foreground">{plan.blurb}</p>
                <p className="mt-4 flex flex-wrap items-baseline gap-2">
                  <span className="font-heading text-3xl font-bold">{formatINR(plan.price)}</span>
                  <span className="text-sm text-muted-foreground line-through">
                    {formatINR(plan.listPrice)}
                  </span>
                  <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                    {savingsPercent(plan)}% off
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatINR(perIssue(plan))} an issue · {plan.issues} issues
                </p>
                <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">
                  {start.label} to {end.label}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="mb-1 font-heading text-xl font-semibold">Where should we post it?</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Every issue goes to this address. Tell us if it changes and we will update it before the
          next one prints.
        </p>
        <SubscribeForm
          signedIn={Boolean(session)}
          knownName={user?.name ?? ""}
          knownEmail={user?.email ?? ""}
          knownPhone={user?.phone ?? ""}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-heading text-lg font-semibold">Questions</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {[
            [
              "When does my first issue arrive?",
              `Your subscription starts with the ${start.label} issue. Each issue is posted as soon as it comes off the press.`,
            ],
            [
              "Does it renew automatically?",
              "No. You pay once for the term you choose and nothing is charged again. We email you before it runs out so you can renew without a gap.",
            ],
            [
              "Can I change my address?",
              "Yes. Reply to your welcome email with your subscription number and we will update it before the next issue goes out.",
            ],
            [
              "Can I gift it?",
              "Yes. Enter the reader's name and address here and put your own email in, so the reminders come to you.",
            ],
          ].map(([q, a]) => (
            <div key={q} className="rounded-xl border bg-card p-4">
              <dt className="flex items-start gap-2 font-medium">
                <Check className="mt-0.5 size-4 shrink-0 text-saffron-deep" /> {q}
              </dt>
              <dd className="mt-1 pl-6 text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
