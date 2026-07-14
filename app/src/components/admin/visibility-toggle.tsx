"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { toggleProductVisible } from "@/lib/admin-actions";

export function VisibilityToggle({ id, visible }: { id: string; visible: boolean }) {
  const router = useRouter();
  return (
    <Switch
      checked={visible}
      aria-label="Toggle store visibility"
      onCheckedChange={async (checked) => {
        const res = await toggleProductVisible(id, checked);
        if (res.error) toast.error(res.error);
        else router.refresh();
      }}
    />
  );
}
