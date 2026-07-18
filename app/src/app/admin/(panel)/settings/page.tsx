import type { Metadata } from "next";

import { SettingsForm, type SettingsValues } from "@/components/admin/settings-form";
import { getSetting } from "@/lib/catalog";
import { DEFAULT_TRACKING_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Admin · Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const initial: SettingsValues = {
    cod_max_order_value: await getSetting("cod_max_order_value", 150000),
    bulk_otp_threshold: await getSetting("bulk_otp_threshold", 500000),
    contact_us_threshold: await getSetting("contact_us_threshold", 2000000),
    free_shipping_threshold: await getSetting("free_shipping_threshold", 0),
    shipping_flat_fee: await getSetting("shipping_flat_fee", 6000),
    origin_pincode: await getSetting("origin_pincode", "500068"),
    store_notice: await getSetting("store_notice", ""),
    contact_phone: await getSetting("contact_phone", "+91 90303 90077"),
    contact_email: await getSetting("contact_email", "saradapublications18@gmail.com"),
    tracking_url_template: await getSetting("tracking_url_template", DEFAULT_TRACKING_URL),
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Store settings</h1>
      <SettingsForm initial={initial} />
    </div>
  );
}
