import type { Metadata } from "next";
import { UsersRound } from "lucide-react";

import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Admin · Customers", robots: { index: false } };
export const dynamic = "force-dynamic";

const PAID = ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      _count: { select: { orders: true } },
      orders: { where: { status: { in: [...PAID] } }, select: { total: true } },
    },
  });

  const fmt = (d: Date | null) =>
    d
      ? d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "2-digit", hour: "numeric", minute: "2-digit" })
      : "never";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold">
          <UsersRound className="size-6 text-saffron-deep" /> Customers ({users.length})
        </h1>
        <p className="text-sm text-muted-foreground">
          Everyone who registered on the store, newest first. Data lives in the Postgres users table.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Customer</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Last login</th>
              <th className="p-3">Orders</th>
              <th className="p-3">Lifetime value</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-secondary/40">
                <td className="p-3">
                  <span className="block font-medium">{u.name}</span>
                  <a href={`mailto:${u.email}`} className="text-xs text-muted-foreground hover:underline">
                    {u.email}
                  </a>
                </td>
                <td className="p-3 text-muted-foreground">{u.phone ?? "-"}</td>
                <td className="p-3 text-muted-foreground">{fmt(u.createdAt)}</td>
                <td className="p-3 text-muted-foreground">{fmt(u.lastLoginAt)}</td>
                <td className="p-3">{u._count.orders}</td>
                <td className="p-3 font-medium">
                  {formatINR(u.orders.reduce((s, o) => s + o.total, 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
