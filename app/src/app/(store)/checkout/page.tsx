import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CheckoutClient } from "@/components/checkout/checkout-client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/checkout");

  const addresses = await db.address.findMany({
    where: { userId: session.uid },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      label: true,
      fullName: true,
      phone: true,
      line1: true,
      line2: true,
      city: true,
      state: true,
      pincode: true,
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-heading text-3xl font-bold">Checkout</h1>
      <CheckoutClient initialAddresses={addresses} />
    </div>
  );
}
