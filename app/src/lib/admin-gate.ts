import "server-only";

import { redirect } from "next/navigation";

import { getStaff, roleCan, type AdminRole, type Capability } from "@/lib/staff-auth";

/**
 * Which parts of the store admin each role may open.
 *
 * Staff sign in with their own accounts and see only their sections. The
 * shared password still arrives as the owner through getStaff(), so it sees
 * everything, exactly as before.
 */

export const ADMIN_SECTIONS = [
  { href: "/admin/orders", label: "Orders", capability: "orders.manage" },
  { href: "/admin/shipments", label: "Shipments", capability: "shipments.manage" },
  { href: "/admin/grievances", label: "Grievances", capability: "grievances.manage" },
  { href: "/admin/kits", label: "School kits", capability: "store.manage" },
  { href: "/admin/products", label: "Products", capability: "store.manage" },
  { href: "/admin/users", label: "Customers", capability: "store.manage" },
  { href: "/admin/coupons", label: "Coupons", capability: "store.manage" },
  { href: "/admin/sales", label: "Festival sales", capability: "store.manage" },
  { href: "/admin/services", label: "Services", capability: "store.manage" },
  { href: "/admin/settings", label: "Settings", capability: "store.manage" },
] as const satisfies readonly { href: string; label: string; capability: Capability }[];

export function adminSectionsFor(role: AdminRole) {
  return ADMIN_SECTIONS.filter((s) => roleCan(role, s.capability));
}

/** The dashboard is for anyone with at least one section to go to. */
export function canEnterAdmin(role: AdminRole): boolean {
  return adminSectionsFor(role).length > 0;
}

/**
 * For a section's layout. Sends a stranger to the login and a colleague without
 * this capability back to the dashboard. The server actions check again, since
 * a layout only runs when someone walks in through the front door.
 */
export async function requireAdminSection(capability: Capability): Promise<void> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  if (!roleCan(staff.role, capability)) redirect("/admin");
}
