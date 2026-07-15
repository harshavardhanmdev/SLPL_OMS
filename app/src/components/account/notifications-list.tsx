"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { markNotificationsRead } from "@/lib/account-actions";
import { cn } from "@/lib/utils";

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationsList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const unread = notifications.filter((n) => !n.readAt).length;

  if (notifications.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No notifications yet. Order updates will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={async () => {
            await markNotificationsRead();
            router.refresh();
          }}
        >
          <CheckCheck className="size-4" /> Mark all {unread} as read
        </Button>
      )}
      <ul className="space-y-2">
        {notifications.map((n) => {
          const inner = (
            <div className="flex gap-3">
              <span
                className={cn(
                  "mt-1 grid size-8 shrink-0 place-items-center rounded-full",
                  n.readAt ? "bg-secondary text-muted-foreground" : "bg-accent text-saffron-deep",
                )}
              >
                <BellRing className="size-4" />
              </span>
              <span className="min-w-0">
                <span className={cn("block text-sm", n.readAt ? "font-medium" : "font-semibold")}>
                  {n.title}
                  {!n.readAt && <span className="ml-2 inline-block size-2 rounded-full bg-saffron" />}
                </span>
                <span className="block text-sm text-muted-foreground">{n.body}</span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </span>
            </div>
          );
          return (
            <li key={n.id} className="rounded-xl border bg-card p-3.5 transition-colors hover:border-saffron/50">
              {n.href ? <Link href={n.href}>{inner}</Link> : inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
