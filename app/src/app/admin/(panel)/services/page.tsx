import type { Metadata } from "next";

import { ServiceEditor, type ServiceRow } from "@/components/admin/service-editor";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Admin · Services", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const services = await db.servicePage.findMany({ orderBy: { sortOrder: "asc" } });

  const rows: ServiceRow[] = services.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    tagline: s.tagline ?? "",
    description: s.description,
    bannerImage: s.bannerImage,
    externalUrl: s.externalUrl,
    sortOrder: s.sortOrder,
    isVisible: s.isVisible,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Services showcase</h1>
        <p className="text-sm text-muted-foreground">
          These cards appear on the home page and the Services page (SL Radio, workshops, SJIS, LMS).
        </p>
      </div>
      <div className="space-y-5">
        {rows.map((s) => (
          <ServiceEditor key={s.id} service={s} />
        ))}
      </div>
    </div>
  );
}
