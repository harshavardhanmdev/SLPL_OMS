export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SchoolForm } from "@/components/admin/school-form";
import { SchoolKitsPanel } from "@/components/admin/school-kits-panel";
import { SchoolPinPanel } from "@/components/admin/school-pin-panel";
import { RosterPanel } from "@/components/admin/roster-panel";
import { db } from "@/lib/db";
import { currentAcademicYear } from "@/lib/kits";
import { formatINR } from "@/lib/money";

type Props = { params: Promise<{ id: string }> };

export default async function AdminSchoolPage({ params }: Props) {
  const { id } = await params;

  const school = await db.school.findUnique({
    where: { id },
    include: {
      kits: {
        include: {
          product: { select: { title: true, price: true, stock: true } },
          _count: { select: { purchases: true } },
        },
        orderBy: [{ academicYear: "desc" }, { classLabel: "asc" }],
      },
      _count: { select: { students: true } },
    },
  });
  if (!school) notFound();

  const bundles = await db.product.findMany({
    where: { kind: "BUNDLE" },
    select: { id: true, title: true, price: true },
    orderBy: { title: "asc" },
  });

  const roster = await db.student.groupBy({
    by: ["classLabel"],
    where: { schoolId: id, isActive: true },
    _count: true,
    orderBy: { classLabel: "asc" },
  });

  const year = currentAcademicYear();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/kits/schools"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Schools
        </Link>
        <h1 className="flex flex-wrap items-center gap-2 font-heading text-2xl font-bold">
          {school.name}
          <Badge variant="secondary">{school.code}</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          {school.city}, {school.state} · {school._count.students} students on the roster
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-1 font-heading font-semibold">Kits for {year}</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              A kit points at a bundle product, so its price, contents and stock stay in one place.
            </p>
            <SchoolKitsPanel
              schoolId={school.id}
              defaultYear={year}
              bundles={bundles}
              kits={school.kits.map((k) => ({
                id: k.id,
                academicYear: k.academicYear,
                classLabel: k.classLabel,
                productId: k.productId,
                productTitle: k.product.title,
                priceLabel: formatINR(k.product.price),
                stock: k.product.stock,
                collectionNote: k.collectionNote ?? "",
                isActive: k.isActive,
                sold: k._count.purchases,
              }))}
            />
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-1 font-heading font-semibold">Student roster</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Parents find their child here instead of typing a name. Import the list the school
              sends you.
            </p>
            <RosterPanel
              schoolId={school.id}
              schoolName={school.name}
              classes={roster.map((r) => ({ classLabel: r.classLabel, count: r._count }))}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-4 font-heading font-semibold">School details</h2>
            <SchoolForm
              school={{
                id: school.id,
                code: school.code,
                name: school.name,
                city: school.city,
                state: school.state,
                udiseCode: school.udiseCode ?? "",
                contactName: school.contactName ?? "",
                contactPhone: school.contactPhone ?? "",
                contactEmail: school.contactEmail ?? "",
                isActive: school.isActive,
              }}
            />
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-1 font-heading font-semibold">Staff PIN</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              School staff sign in at /kits/verify with the code {school.code} and this PIN. It lets
              them mark their own school&apos;s kits collected, nothing else.
            </p>
            <SchoolPinPanel schoolId={school.id} hasPin={Boolean(school.verifyPin)} />
          </section>
        </div>
      </div>
    </div>
  );
}
