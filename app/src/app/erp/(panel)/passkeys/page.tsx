export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasskeyManager } from "@/components/erp/passkey-controls";
import { db } from "@/lib/db";
import { getStaff } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Fingerprint sign-in", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function PasskeysPage() {
  const staff = await getStaff();
  if (!staff) redirect("/erp/signin?next=/erp/passkeys");

  const passkeys = staff.breakGlass
    ? []
    : await db.staffPasskey.findMany({
        where: { adminUserId: staff.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
      });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Fingerprint sign-in</h1>
        <p className="text-sm text-muted-foreground">
          Sign in with a touch or a look, on the phones you choose.
        </p>
      </div>
      {staff.breakGlass ? (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Sign in with your own account to set this up. The shared owner password cannot have it.
        </p>
      ) : (
        <PasskeyManager
          passkeys={passkeys.map((p) => ({
            id: p.id,
            deviceName: p.deviceName,
            createdAt: dateIN(p.createdAt),
            lastUsedAt: p.lastUsedAt ? dateIN(p.lastUsedAt) : null,
          }))}
        />
      )}
    </div>
  );
}
