export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Clock, LifeBuoy, MailCheck, Phone, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GrievanceForm } from "@/components/store/grievance-form";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGrievanceOfficer, ACK_SLA_HOURS, RESOLUTION_SLA_DAYS } from "@/lib/grievances";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Raise a complaint",
  description:
    "Report a payment, refund or delivery problem to SLPL Store. Every complaint gets a ticket number, an acknowledgement within 48 hours and a named grievance officer.",
};

type Props = { searchParams: Promise<{ order?: string; category?: string }> };

export default async function GrievancePage({ searchParams }: Props) {
  const { order, category } = await searchParams;
  const [session, officer] = await Promise.all([getSession(), getGrievanceOfficer()]);

  const me = session
    ? await db.user.findUnique({ where: { id: session.uid }, select: { name: true, email: true } })
    : null;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <div className="mb-3 inline-flex rounded-xl bg-accent p-3 text-saffron-deep">
          <LifeBuoy className="size-7" />
        </div>
        <h1 className="font-heading text-3xl font-bold">Raise a complaint</h1>
        <p className="mt-2 text-muted-foreground">
          Something gone wrong with a payment, a refund or a delivery? Tell us here. You will get a
          ticket number straight away and a link to follow progress. You do not need an account.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <GrievanceForm
          defaultOrder={order ?? ""}
          defaultCategory={category ?? ""}
          signedIn={Boolean(session)}
          knownName={me?.name ?? ""}
          knownEmail={me?.email ?? ""}
        />

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-secondary/60 p-5 dark:bg-card">
            <h2 className="font-heading text-lg font-semibold">Our commitment to you</h2>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MailCheck className="mt-0.5 size-4 shrink-0 text-saffron-deep" />
                <span>
                  <b>Acknowledged within {ACK_SLA_HOURS} hours</b>
                  <span className="block text-muted-foreground">You hear from a real person, not a bot.</span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-saffron-deep" />
                <span>
                  <b>Resolved within {RESOLUTION_SLA_DAYS} days</b>
                  <span className="block text-muted-foreground">
                    Usually far sooner. Payment issues are treated as priority.
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-saffron-deep" />
                <span>
                  <b>A named officer is accountable</b>
                  <span className="block text-muted-foreground">
                    {officer.name}, Grievance Officer, {site.company}.
                  </span>
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">Need to talk instead?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              For anything urgent, especially money debited without an order, call us. Support hours
              are Monday to Saturday, 9:30 am to 6:30 pm IST.
            </p>
            <p className="mt-3 text-sm">
              <a
                href={`tel:${officer.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-2 font-medium hover:underline"
              >
                <Phone className="size-4 text-saffron-deep" /> {officer.phone}
              </a>
              <a href={`mailto:${officer.email}`} className="mt-1 block break-all hover:underline">
                {officer.email}
              </a>
            </p>
            <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
              <Link href="/policies/grievance">Read the grievance policy</Link>
            </Button>
          </div>

          <p className="px-1 text-xs text-muted-foreground">
            Already filed one? The tracking link is in your acknowledgement email. Signed-in
            customers can also see everything under{" "}
            <Link href="/account/grievances" className="underline underline-offset-2">
              my complaints
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
