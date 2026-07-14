"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { UploadButton } from "@/components/admin/upload-button";
import { saveService, type ServiceInput } from "@/lib/admin-actions";

export type ServiceRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  bannerImage: string | null;
  externalUrl: string | null;
  sortOrder: number;
  isVisible: boolean;
};

export function ServiceEditor({ service }: { service: ServiceRow }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState(service);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const input: ServiceInput = {
        id: v.id,
        title: v.title,
        tagline: v.tagline,
        description: v.description,
        bannerImage: v.bannerImage,
        externalUrl: v.externalUrl || null,
        sortOrder: v.sortOrder,
        isVisible: v.isVisible,
      };
      const res = await saveService(input);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Service saved");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-2xl border bg-card p-5 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        <div className="relative aspect-[2/1] overflow-hidden rounded-lg border bg-muted">
          {v.bannerImage ? (
            <Image src={v.bannerImage} alt="" fill sizes="280px" className="object-cover object-top" />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-muted-foreground">No banner</span>
          )}
        </div>
        <div className="flex gap-2">
          <UploadButton kind="image" label="Upload banner" onUploaded={(url) => setV({ ...v, bannerImage: url })} />
          {v.bannerImage && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setV({ ...v, bannerImage: null })}>
              Remove
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Link (Learn more URL)</Label>
            <Input
              value={v.externalUrl ?? ""}
              onChange={(e) => setV({ ...v, externalUrl: e.target.value || null })}
              placeholder="https://…"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Tagline</Label>
          <Input value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={v.isVisible} onCheckedChange={(c) => setV({ ...v, isVisible: c === true })} />
            Visible on the site
          </label>
          <div className="flex items-center gap-2 text-sm">
            <Label className="text-sm">Order</Label>
            <Input
              type="number"
              min={0}
              max={99}
              className="w-20"
              value={v.sortOrder}
              onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) })}
            />
          </div>
          <Button type="submit" size="sm" className="ml-auto gap-2" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
        </div>
      </div>
    </form>
  );
}
