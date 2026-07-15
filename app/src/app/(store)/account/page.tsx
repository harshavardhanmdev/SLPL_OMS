import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, LogOut, MapPin, Package, Settings2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AddressesManager,
  AvatarUploader,
  ProfileForm,
  SettingsPanel,
  type AddressRow,
} from "@/components/account/account-sections";
import { NotificationsList } from "@/components/account/notifications-list";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";
import { db } from "@/lib/db";
import { DEFAULT_PREFS, type NotificationPrefs } from "@/lib/notify";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");

  const [user, addresses, notifications] = await Promise.all([
    db.user.findUnique({ where: { id: session.uid } }),
    db.address.findMany({
      where: { userId: session.uid },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    db.notification.findMany({
      where: { userId: session.uid },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  if (!user) redirect("/login?next=/account");

  const prefs: NotificationPrefs = {
    ...DEFAULT_PREFS,
    ...((user.notificationPrefs as Partial<NotificationPrefs>) ?? {}),
  };
  const addressRows: AddressRow[] = addresses.map((a) => ({
    id: a.id,
    name: a.name ?? "",
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? "",
    landmark: a.landmark ?? "",
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    lat: a.lat,
    lng: a.lng,
    isDefault: a.isDefault,
  }));
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Header card */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <AvatarUploader image={user.image} name={user.name} />
          <div>
            <h1 className="font-heading text-2xl font-bold">{user.name}</h1>
            <p className="text-sm text-muted-foreground">
              {user.email}
              {user.phone ? ` · ${user.phone}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/account/orders">
              <Package className="size-4" /> Returns & Orders
            </Link>
          </Button>
          <form action={logoutAction}>
            <Button variant="outline" className="gap-2">
              <LogOut className="size-4" /> Log out
            </Button>
          </form>
        </div>
      </div>

      <div className="space-y-10">
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold">
            <UserRound className="size-5 text-saffron-deep" /> Account details
          </h2>
          <div className="rounded-2xl border bg-card p-5">
            <ProfileForm name={user.name} phone={user.phone ?? ""} email={user.email} />
          </div>
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold">
            <MapPin className="size-5 text-saffron-deep" /> Delivery addresses
          </h2>
          <AddressesManager addresses={addressRows} />
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold">
            <Bell className="size-5 text-saffron-deep" /> Notifications
            {unread > 0 && (
              <span className="rounded-full bg-saffron px-2 py-0.5 text-xs font-bold text-navy">{unread}</span>
            )}
          </h2>
          <NotificationsList notifications={notifications} />
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold">
            <Settings2 className="size-5 text-saffron-deep" /> Settings
          </h2>
          <SettingsPanel prefs={prefs} />
        </section>
      </div>
    </div>
  );
}
