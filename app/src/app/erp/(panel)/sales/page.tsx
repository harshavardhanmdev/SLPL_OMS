export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  CalendarClock,
  FileSignature,
  Gift,
  Package,
  Plus,
  Receipt,
  Tags,
  Target,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TargetBanner } from "@/components/erp/target-banner";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";
import { salesBanner } from "@/lib/sales-summary";

export const metadata: Metadata = { title: "Sales", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Where Harish and Uday start their day: how far off target, what is overdue,
 * and large buttons for the things they actually do.
 */
export default async function SalesHome() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");

  const personal = staff.breakGlass ? null : staff.id;
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [banner, due, recent] = await Promise.all([
    salesBanner(personal),
    db.visit.findMany({
      where: {
        converted: false,
        // A school marked lost needs no more follow-ups
        organization: { status: { not: "LOST" } },
        nextActionOn: { lt: new Date(startOfDay.getTime() + 86400000) },
        ...(personal ? { byId: personal } : {}),
      },
      orderBy: { nextActionOn: "asc" },
      take: 12,
      include: { organization: { select: { id: true, name: true } } },
    }),
    db.visit.findMany({
      where: personal ? { byId: personal } : {},
      orderBy: { visitedOn: "desc" },
      take: 6,
      include: { organization: { select: { id: true, name: true } } },
    }),
  ]);

  const actions = [
    { href: "/erp/visits/new", label: "Log a visit", icon: CalendarClock, show: true },
    { href: "/erp/organizations", label: "Schools", icon: Building2, show: true },
    { href: "/erp/quotations/new", label: "Quotation", icon: FileSignature, show: roleCan(staff.role, "quotes.write") },
    { href: "/erp/invoices/new", label: "Invoice", icon: Receipt, show: roleCan(staff.role, "invoices.write") },
    { href: "/erp/samples", label: "Samples", icon: Package, show: true },
    { href: "/erp/gifts", label: "Gifts", icon: Gift, show: true },
    { href: "/erp/targets", label: "Targets", icon: Target, show: true },
    { href: "/erp/prices", label: "Price list", icon: Tags, show: roleCan(staff.role, "quotes.read") },
    { href: "/erp/challans", label: "Challans", icon: Truck, show: roleCan(staff.role, "challan.write") },
  ].filter((a) => a.show);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Sales</h1>
        <p className="text-sm text-muted-foreground">
          {staff.name}
          {banner.myVisitTarget > 0
            ? ` · ${banner.myVisitsThisMonth} of ${banner.myVisitTarget} visits this month`
            : ` · ${banner.myVisitsThisMonth} visits this month`}
        </p>
      </div>

      {banner.mine && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TargetBanner pace={banner.mine.month} title="My target this month" />
          <TargetBanner pace={banner.mine.year} title="My target this year" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TargetBanner
          pace={banner.company.month}
          title="Company this month"
          subtitle="Everyone's invoices"
        />
        <TargetBanner pace={banner.company.year} title="Company this year" />
      </div>

      {/* Big obvious buttons, because this is used between school visits */}
      <div className="erp-stagger grid grid-cols-3 gap-3">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="erp-lift flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center hover:border-saffron sm:p-5"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-saffron-deep sm:size-12">
              <a.icon className="size-6" />
            </span>
            <span className="text-sm font-medium sm:text-base">{a.label}</span>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <div>
            <h2 className="font-heading font-semibold">What needs doing</h2>
            <p className="text-sm text-muted-foreground">
              {banner.overdueActions} overdue, {banner.todayActions} due today.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" asChild>
            <Link href="/erp/visits/new">
              <Plus className="size-3.5" /> Log a visit
            </Link>
          </Button>
        </div>
        {due.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nothing overdue. Every follow-up is in the future.
          </p>
        ) : (
          <ul className="erp-stagger divide-y">
            {due.map((v) => {
              const overdue = v.nextActionOn < startOfDay;
              return (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link
                      href={`/erp/organizations/${v.organization.id}`}
                      className="font-medium hover:underline"
                    >
                      {v.organization.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{v.nextAction}</p>
                  </div>
                  <Badge
                    className={
                      overdue
                        ? "erp-ring border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-saffron/40 bg-saffron/15 text-saffron-deep"
                    }
                  >
                    {overdue ? "Overdue " : "Today "} {dateIN(v.nextActionOn)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section className="rounded-2xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-heading font-semibold">Recently logged</h2>
          </div>
          <ul className="divide-y">
            {recent.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link
                    href={`/erp/organizations/${v.organization.id}`}
                    className="font-medium hover:underline"
                  >
                    {v.organization.name}
                  </Link>
                  <p className="line-clamp-1 text-sm text-muted-foreground">{v.summary}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {dateIN(v.visitedOn)}
                  {v.converted && (
                    <Badge className="ml-2 border-green-300 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                      Converted
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
