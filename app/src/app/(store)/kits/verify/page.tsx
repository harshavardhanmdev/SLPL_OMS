export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { QrCode } from "lucide-react";

import { KitStaffPanel } from "@/components/store/kit-staff-panel";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/kit-staff-auth";
import { currentAcademicYear } from "@/lib/kits";

export const metadata: Metadata = { title: "Kit collection", robots: { index: false } };

export default async function KitVerifyPage() {
  const staff = await getStaffSession();

  const summary = staff
    ? await db.kitPurchase.groupBy({
        by: ["status"],
        where: {
          schoolKit: { schoolId: staff.schoolId, academicYear: currentAcademicYear() },
        },
        _count: true,
      })
    : [];
  const count = (status: string) => summary.find((s) => s.status === status)?._count ?? 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <header className="mb-6 text-center">
        <QrCode className="mx-auto size-8 text-saffron-deep" />
        <h1 className="mt-2 font-heading text-2xl font-bold">Kit collection</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For school staff handing kits over. Scan the family&apos;s QR code, or type the receipt
          number if the code will not scan.
        </p>
      </header>

      <KitStaffPanel
        staff={staff}
        counts={{
          awaiting: count("PAID") + count("READY"),
          collected: count("COLLECTED"),
        }}
      />
    </div>
  );
}
