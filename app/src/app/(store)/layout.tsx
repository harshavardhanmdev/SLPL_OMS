import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileBottomNav } from "@/components/layout/mobile-nav";
import { getSetting } from "@/lib/catalog";

export default async function StoreLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const notice = await getSetting<string>("store_notice", "");

  return (
    <>
      {notice && (
        <p className="bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
          {notice}
        </p>
      )}
      <SiteHeader />
      <main className="flex-1 pb-safe-nav md:pb-0">{children}</main>
      <SiteFooter />
      <MobileBottomNav />
    </>
  );
}
