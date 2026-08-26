import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  CheckCheck,
  MessageSquareWarning,
  Search,
  TriangleAlert,
  UserRoundCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { GrievanceActions } from "@/components/admin/grievance-actions";
import { db } from "@/lib/db";
import { categoryLabel, isAckOverdue, isResolutionOverdue } from "@/lib/grievances";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin · Grievances", robots: { index: false } };
export const dynamic = "force-dynamic";

type Stage = {
  key: string;
  title: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  statuses: string[];
};

const STAGES: Stage[] = [
  {
    key: "new",
    title: "Needs acknowledgement",
    hint: "The rules give us 48 hours to acknowledge. Do these first.",
    icon: MessageSquareWarning,
    statuses: ["OPEN"],
  },
  {
    key: "working",
    title: "Being investigated",
    hint: "Acknowledged and with the team.",
    icon: Search,
    statuses: ["ACKNOWLEDGED", "IN_PROGRESS"],
  },
  {
    key: "waiting",
    title: "Waiting on the customer",
    hint: "We have asked for something. Chase if it goes quiet.",
    icon: UserRoundCheck,
    statuses: ["AWAITING_CUSTOMER"],
  },
  {
    key: "escalated",
    title: "Escalated",
    hint: "Needs a decision or an external channel.",
    icon: TriangleAlert,
    statuses: ["ESCALATED"],
  },
];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "payment", label: "Payment issues" },
  { key: "delivery", label: "Delivery" },
  { key: "other", label: "Other" },
] as const;

const CATEGORY_GROUPS: Record<string, string[]> = {
  payment: ["PAYMENT_DEBITED_NO_ORDER", "REFUND_NOT_RECEIVED", "DOUBLE_CHARGED"],
  delivery: ["ORDER_NOT_DELIVERED", "DAMAGED_OR_WRONG_ITEM", "CANCELLATION_ISSUE"],
  other: ["DATA_PRIVACY", "OTHER"],
};

const hoursAgo = (d: Date) => Math.floor((Date.now() - d.getTime()) / 3600_000);

type Props = { searchParams: Promise<{ f?: string }> };

export default async function AdminGrievancesPage({ searchParams }: Props) {
  const { f } = await searchParams;
  const filter = f && FILTERS.some((x) => x.key === f) ? f : "all";
  const categoryWhere =
    filter === "all" ? {} : { category: { in: CATEGORY_GROUPS[filter] as never[] } };

  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [active, recentlyClosed] = await Promise.all([
    db.grievance.findMany({
      where: {
        status: { in: STAGES.flatMap((s) => s.statuses) as never[] },
        ...categoryWhere,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: { order: { select: { orderNumber: true } } },
      take: 200,
    }),
    db.grievance.findMany({
      where: { status: { in: ["RESOLVED", "CLOSED"] as never[] }, updatedAt: { gte: weekAgo }, ...categoryWhere },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  const row = (g: (typeof active)[number]) => {
    const ackLate = isAckOverdue(g);
    const resolutionLate = isResolutionOverdue(g);
    return (
      <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/grievances/${g.ticketNumber}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              {g.ticketNumber}
            </Link>
            {g.priority !== "NORMAL" && (
              <Badge className="bg-saffron text-navy">{g.priority.toLowerCase()}</Badge>
            )}
            {ackLate && <Badge className="bg-destructive text-white">Acknowledgement overdue</Badge>}
            {resolutionLate && <Badge className="bg-destructive text-white">Past 30 days</Badge>}
          </p>
          <p className="mt-0.5 line-clamp-1 text-sm font-medium">{g.subject}</p>
          <p className="text-sm text-muted-foreground">
            {categoryLabel(g.category)} · {g.contactName} · {hoursAgo(g.createdAt)}h ago
            {g.order?.orderNumber ? ` · ${g.order.orderNumber}` : g.orderRef ? ` · ${g.orderRef}` : ""}
            {g.amountClaimed != null ? ` · ${formatINR(g.amountClaimed)} disputed` : ""}
          </p>
        </div>
        <GrievanceActions ticketNumber={g.ticketNumber} status={g.status} compact />
      </li>
    );
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Grievances</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every customer complaint, with the clock we are held to: acknowledge in 48 hours, resolve
          in 30 days.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/grievances?f=${tab.key}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === tab.key
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-secondary",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {STAGES.map(({ key, title, hint, icon: Icon, statuses }) => {
        const rows = active.filter((g) => statuses.includes(g.status));
        const overdue = rows.filter((g) => isAckOverdue(g) || isResolutionOverdue(g)).length;
        return (
          <section key={key} className="rounded-2xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b p-4">
              <h2 className="flex items-center gap-2 font-heading font-semibold">
                <Icon className="size-4 text-saffron-deep" /> {title}
                <Badge variant={rows.length > 0 ? "default" : "secondary"}>{rows.length}</Badge>
                {overdue > 0 && <Badge className="bg-destructive text-white">{overdue} overdue</Badge>}
              </h2>
              <p className="hidden text-xs text-muted-foreground sm:block">{hint}</p>
            </div>
            {rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nothing here right now.</p>
            ) : (
              <ul className="divide-y">{rows.map(row)}</ul>
            )}
          </section>
        );
      })}

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <h2 className="flex items-center gap-2 font-heading font-semibold">
            <CheckCheck className="size-4 text-green-700 dark:text-green-400" /> Settled (last 7 days)
            <Badge variant="secondary">{recentlyClosed.length}</Badge>
          </h2>
        </div>
        {recentlyClosed.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nothing settled in the last week.</p>
        ) : (
          <ul className="divide-y">
            {recentlyClosed.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm">
                <Link
                  href={`/admin/grievances/${g.ticketNumber}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {g.ticketNumber}
                </Link>
                <BadgeCheck className="size-4 text-green-700 dark:text-green-400" />
                <span className="text-muted-foreground">
                  {g.subject} · {g.contactName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
