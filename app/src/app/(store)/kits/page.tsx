export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, MapPin, QrCode, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { currentAcademicYear } from "@/lib/kits";

export const metadata: Metadata = {
  title: "School kits",
  description:
    "Pay online for your child's school kit: books, workbooks, stationery and files for the year. Show the receipt at the school and collect it there.",
};

export default async function KitsPage() {
  const year = currentAcademicYear();
  const schools = await db.school.findMany({
    where: { isActive: true, kits: { some: { isActive: true, academicYear: year } } },
    select: {
      code: true,
      name: true,
      city: true,
      _count: { select: { kits: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-semibold text-saffron-deep">Academic year {year}</p>
        <h1 className="mt-1 font-heading text-3xl font-bold sm:text-4xl">School kits</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Pay for your child&apos;s full year of books, workbooks and stationery in one go. We send
          you a receipt with a QR code. Show it at the school and collect the kit there, so there is
          nothing to wait for and nothing to courier.
        </p>
      </header>

      <ol className="mb-10 grid gap-4 sm:grid-cols-3">
        {[
          { icon: GraduationCap, title: "Pick the school and class", body: "Find your child on the school roster." },
          { icon: ShieldCheck, title: "Pay online", body: "UPI, cards or netbanking, the same as any order." },
          { icon: QrCode, title: "Collect at school", body: "Show the QR receipt at the school office." },
        ].map((step, i) => (
          <li key={step.title} className="rounded-2xl border bg-card p-5">
            <step.icon className="size-6 text-saffron-deep" />
            <p className="mt-3 text-xs font-semibold text-muted-foreground">STEP {i + 1}</p>
            <p className="font-heading font-semibold">{step.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>

      <h2 className="mb-4 font-heading text-xl font-semibold">Choose your school</h2>
      {schools.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="font-medium">No school kits are open for {year} yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If your school works with us, kits open here before the term starts. Ask the school
            office, or write to us and we will set it up.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {schools.map((school) => (
            <li key={school.code}>
              <Link
                href={`/kits/${school.code}`}
                className="flex h-full flex-col rounded-2xl border bg-card p-5 transition hover:border-saffron hover:shadow-sm"
              >
                <span className="font-heading font-semibold">{school.name}</span>
                <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" /> {school.city}
                </span>
                <span className="mt-3 text-sm font-medium text-saffron-deep">
                  {school._count.kits} kit{school._count.kits === 1 ? "" : "s"} available
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        School staff handing kits over:{" "}
        <Link href="/kits/verify" className="font-medium text-foreground hover:underline">
          open the verification screen
        </Link>
        .
      </p>
    </div>
  );
}
