import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account" };

/** Placeholder until M4 ships sign-in — keeps the bottom-nav target alive. */
export default function AccountPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="rounded-full bg-accent p-5 text-saffron-deep">
        <UserRound className="size-8" />
      </div>
      <h1 className="font-heading text-2xl font-bold">Accounts are coming online</h1>
      <p className="text-muted-foreground">
        Sign-in, saved addresses and order tracking are being wired up. Your
        cart already works — no account needed to browse.
      </p>
      <Button variant="outline" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
