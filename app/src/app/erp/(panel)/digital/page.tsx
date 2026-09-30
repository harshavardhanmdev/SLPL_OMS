export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Mail, Monitor, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LicenceControls } from "@/components/erp/licence-controls";
import { db } from "@/lib/db";
import { daysAgo } from "@/lib/digital-access";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Digital editions", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Addresses seen in the last 30 days. A shared login shows up here first. */
const RECENT_DAYS = 30;

export default async function DigitalPage() {
  const staff = await getStaff();
  const canManage = staff ? roleCan(staff.role, "orders.manage") : false;
  const since = daysAgo(RECENT_DAYS);

  const licences = await db.digitalEntitlement.findMany({
    include: {
      user: { select: { name: true, email: true, phone: true } },
      product: { select: { title: true, price: true } },
      views: { where: { at: { gte: since } }, select: { ip: true } },
    },
    orderBy: { grantedAt: "desc" },
  });

  const active = licences.filter((l) => !l.revokedAt);
  const revenue = active.reduce((sum, l) => sum + l.product.price, 0);
  const rows = licences.map((l) => ({
    ...l,
    devices: new Set(l.views.map((v) => v.ip).filter(Boolean)).size,
  }));
  const spread = rows.filter((l) => !l.revokedAt && l.devices > 5).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Digital editions</h1>
        <p className="text-sm text-muted-foreground">
          Who can read which issue. Every page a reader opens carries their name, so a leaked page
          names its source. A screenshot cannot be stopped, and the copy we show customers says so.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Active licences", String(active.length), "readers who can open an issue"],
          ["Withdrawn", String(licences.length - active.length), "by hand, with a reason"],
          ["Collected", formatINR(revenue), "at the current price"],
          ["Worth a look", String(spread), `over 5 addresses in ${RECENT_DAYS} days`],
        ].map(([head, value, hint]) => (
          <div key={head} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{head}</p>
            <p className="font-heading text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Monitor className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nobody has bought a digital edition yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            They appear here the moment a reader pays.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((l) => (
            <li key={l.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-semibold">
                    {l.user.name}
                    <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                      {l.code}
                    </span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {l.user.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3.5" /> {l.user.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Mail className="size-3.5" /> {l.user.email}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  {l.revokedAt ? (
                    <Badge className="bg-muted text-muted-foreground border-border">Withdrawn</Badge>
                  ) : (
                    <Badge className="border-green-300 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                      Active
                    </Badge>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {l.viewCount} pages opened
                    {l.devices > 0 ? ` from ${l.devices} address${l.devices === 1 ? "" : "es"}` : ""}
                  </p>
                </div>
              </div>

              <p className="mt-2 text-sm">{l.product.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bought {dateIN(l.grantedAt)}
                {l.lastViewedAt ? ` · last opened ${dateIN(l.lastViewedAt)}` : " · never opened"}
                {l.revokeReason ? ` · withdrawn: ${l.revokeReason}` : ""}
              </p>

              {canManage && (
                <div className="mt-3 border-t pt-3">
                  <LicenceControls id={l.id} code={l.code} revoked={Boolean(l.revokedAt)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
