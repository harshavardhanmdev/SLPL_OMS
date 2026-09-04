export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SchoolForm } from "@/components/admin/school-form";
import { db } from "@/lib/db";

export default async function AdminSchoolsPage() {
  const schools = await db.school.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      city: true,
      isActive: true,
      verifyPin: true,
      _count: { select: { students: true, kits: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/kits"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Kit board
        </Link>
        <h1 className="font-heading text-2xl font-bold">Schools</h1>
        <p className="text-sm text-muted-foreground">
          Each school needs a code, a kit per class, a roster and a PIN for its staff.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border bg-card">
          {schools.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No schools yet. Add the first one on the right.
            </p>
          ) : (
            <ul className="divide-y">
              {schools.map((school) => (
                <li key={school.id}>
                  <Link
                    href={`/admin/kits/schools/${school.id}`}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {school.name}
                        <Badge variant="secondary">{school.code}</Badge>
                        {!school.isActive && <Badge variant="outline">inactive</Badge>}
                        {!school.verifyPin && (
                          <Badge className="border-saffron/40 bg-saffron/20 text-saffron-deep">
                            no staff PIN
                          </Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {school.city} · {school._count.kits} kit
                        {school._count.kits === 1 ? "" : "s"} · {school._count.students} student
                        {school._count.students === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="h-fit rounded-2xl border bg-card p-5">
          <h2 className="mb-4 font-heading font-semibold">Add a school</h2>
          <SchoolForm />
        </div>
      </div>
    </div>
  );
}
