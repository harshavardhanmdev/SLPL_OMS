import { requireAdminSection } from "@/lib/admin-gate";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdminSection("shipments.manage");
  return children;
}
