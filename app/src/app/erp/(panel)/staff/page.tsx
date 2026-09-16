export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { StaffManager } from "@/components/erp/staff-manager";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Staff", robots: { index: false } };

export default async function StaffPage() {
  const me = await getStaff();
  if (!me || !roleCan(me.role, "staff.manage")) redirect("/erp");

  const people = await db.adminUser.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } } } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Who can sign in, and what they are allowed to touch. Changing a password or deactivating
          an account ends every session they have open.
        </p>
      </div>
      {people.length === 0 && (
        <Badge variant="outline">No staff accounts yet, add the first below</Badge>
      )}
      <StaffManager
        people={people.map((p) => ({
          id: p.id,
          email: p.email,
          name: p.name,
          role: p.role,
          isActive: p.isActive,
          lastLoginAt: p.lastLoginAt?.toISOString() ?? null,
          activeSessions: p._count.sessions,
        }))}
      />
    </div>
  );
}
