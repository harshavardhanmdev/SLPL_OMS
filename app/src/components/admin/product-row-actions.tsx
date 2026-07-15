"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteProduct } from "@/lib/admin-actions";

export function ProductRowActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" className="gap-1.5" asChild>
        <Link href={`/admin/products/${id}`}>
          <Pencil className="size-3.5" /> Edit
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-destructive hover:bg-destructive/10"
        onClick={async () => {
          if (!confirm(`Delete "${title}" permanently? Past orders keep their records.`)) return;
          const res = await deleteProduct(id);
          if (res.error) toast.error(res.error);
          else {
            toast.success("Product deleted");
            router.refresh();
          }
        }}
      >
        <Trash2 className="size-3.5" /> Delete
      </Button>
    </div>
  );
}
