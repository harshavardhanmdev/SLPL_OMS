"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print receipt" }: { label?: string }) {
  return (
    <Button variant="outline" className="gap-2" onClick={() => window.print()}>
      <Printer className="size-4" /> {label}
    </Button>
  );
}
