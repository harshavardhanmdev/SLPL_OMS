"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadButton } from "@/components/admin/upload-button";
import { deleteProduct, saveProduct, setBundleItems } from "@/lib/admin-actions";

type Category = { id: string; name: string };
type MemberOption = { id: string; title: string };

export type ProductFormValue = {
  id?: string;
  title: string;
  slug: string;
  kind: "BOOK" | "NOVEL" | "POEMS" | "BUNDLE";
  categoryId: string;
  series: string;
  gradeLabel: string;
  description: string;
  mrp: number; // paise
  price: number;
  salePrice: number | null;
  saleStart: string | null; // datetime-local
  saleEnd: string | null;
  stock: number;
  weightGrams: number;
  coverImage: string | null;
  gallery: string[];
  samplePdf: string | null;
  isNewRelease: boolean;
  isFeatured: boolean;
  isVisible: boolean;
  bundleItems: { productId: string; quantity: number }[];
};

const toRupees = (paise: number | null) => (paise == null ? "" : String(paise / 100));
const toPaise = (rupees: string) => Math.round(Number(rupees || 0) * 100);

export function ProductForm({
  initial,
  categories,
  memberOptions,
}: {
  initial: ProductFormValue;
  categories: Category[];
  memberOptions: MemberOption[];
}) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [mrp, setMrp] = React.useState(toRupees(initial.mrp));
  const [price, setPrice] = React.useState(toRupees(initial.price));
  const [salePrice, setSalePrice] = React.useState(toRupees(initial.salePrice));
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof ProductFormValue>(key: K, value: ProductFormValue[K]) {
    setV((old) => ({ ...old, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveProduct({
        id: v.id,
        title: v.title,
        slug: v.slug,
        kind: v.kind,
        categoryId: v.categoryId,
        series: v.series,
        gradeLabel: v.gradeLabel,
        description: v.description,
        mrp: toPaise(mrp),
        price: toPaise(price),
        salePrice: salePrice ? toPaise(salePrice) : null,
        saleStart: v.saleStart || null,
        saleEnd: v.saleEnd || null,
        stock: v.stock,
        weightGrams: v.weightGrams,
        coverImage: v.coverImage,
        gallery: v.gallery,
        samplePdf: v.samplePdf,
        isNewRelease: v.isNewRelease,
        isFeatured: v.isFeatured,
        isVisible: v.isVisible,
      });
      if (res.error) {
        toast.error(res.error === "UNAUTHORIZED" ? "Session expired - log in again." : res.error);
        return;
      }
      if (v.kind === "BUNDLE" && res.id) {
        const bundleRes = await setBundleItems(res.id, v.bundleItems.filter((b) => b.productId));
        if (bundleRes.error) {
          toast.error(bundleRes.error);
          return;
        }
      }
      toast.success("Saved");
      router.push("/admin/products");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!v.id) return;
    if (!confirm(`Delete “${v.title}” permanently?`)) return;
    const res = await deleteProduct(v.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Deleted");
    router.push("/admin/products");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid max-w-5xl gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Title</Label>
            <Input required value={v.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>
              Slug <span className="text-muted-foreground">(URL, auto if empty)</span>
            </Label>
            <Input value={v.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto-from-title" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={v.kind} onValueChange={(k) => set("kind", k as ProductFormValue["kind"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BOOK">Textbook</SelectItem>
                <SelectItem value="NOVEL">Novel</SelectItem>
                <SelectItem value="POEMS">Poems</SelectItem>
                <SelectItem value="BUNDLE">Bundle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={v.categoryId} onValueChange={(c) => set("categoryId", c)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>
              Series <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input value={v.series} onChange={(e) => set("series", e.target.value)} placeholder="e.g. Skill Builders" />
          </div>
          <div className="space-y-1.5">
            <Label>
              Grade label <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input value={v.gradeLabel} onChange={(e) => set("gradeLabel", e.target.value)} placeholder="e.g. Grade 6" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Description (3-5 lines shown on the product page)</Label>
          <Textarea
            required
            rows={5}
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>MRP (₹)</Label>
            <Input required inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Selling price (₹)</Label>
            <Input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>
              Sale price (₹) <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="-" />
          </div>
        </div>

        {salePrice && (
          <div className="grid gap-4 rounded-xl border bg-accent/40 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sale starts</Label>
              <Input
                type="datetime-local"
                value={v.saleStart ?? ""}
                onChange={(e) => set("saleStart", e.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sale ends</Label>
              <Input
                type="datetime-local"
                value={v.saleEnd ?? ""}
                onChange={(e) => set("saleEnd", e.target.value || null)}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Leave dates empty for an always-on sale price.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Stock (copies)</Label>
            <Input
              required
              type="number"
              min={0}
              value={v.stock}
              onChange={(e) => set("stock", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Weight (grams - used for shipping)</Label>
            <Input
              required
              type="number"
              min={50}
              value={v.weightGrams}
              onChange={(e) => set("weightGrams", Number(e.target.value))}
            />
          </div>
        </div>

        {v.kind === "BUNDLE" && (
          <div className="space-y-3 rounded-xl border bg-secondary/50 p-4 dark:bg-card">
            <Label className="font-heading">Books inside this bundle</Label>
            {v.bundleItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={item.productId}
                  onValueChange={(pid) =>
                    set(
                      "bundleItems",
                      v.bundleItems.map((b, i) => (i === idx ? { ...b, productId: pid } : b)),
                    )
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Pick a book" />
                  </SelectTrigger>
                  <SelectContent>
                    {memberOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className="w-20"
                  value={item.quantity}
                  onChange={(e) =>
                    set(
                      "bundleItems",
                      v.bundleItems.map((b, i) =>
                        i === idx ? { ...b, quantity: Number(e.target.value) } : b,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => set("bundleItems", v.bundleItems.filter((_, i) => i !== idx))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => set("bundleItems", [...v.bundleItems, { productId: "", quantity: 1 }])}
            >
              <Plus className="size-4" /> Add book
            </Button>
          </div>
        )}
      </div>

      {/* Right column: media + flags + actions */}
      <aside className="space-y-5">
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <Label>Cover image</Label>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border bg-muted">
            {v.coverImage ? (
              <Image src={v.coverImage} alt="" fill sizes="280px" className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No cover yet
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <UploadButton kind="image" label="Upload cover" onUploaded={(url) => set("coverImage", url)} />
            {v.coverImage && (
              <Button type="button" variant="ghost" size="sm" onClick={() => set("coverImage", null)}>
                Remove
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border bg-card p-4">
          <Label>Gallery ({v.gallery.length}/8)</Label>
          {v.gallery.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {v.gallery.map((g) => (
                <button
                  key={g}
                  type="button"
                  title="Remove"
                  className="group relative aspect-[3/4] overflow-hidden rounded-md border"
                  onClick={() => set("gallery", v.gallery.filter((x) => x !== g))}
                >
                  <Image src={g} alt="" fill sizes="70px" className="object-cover" />
                  <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-white group-hover:flex">
                    <X className="size-4" />
                  </span>
                </button>
              ))}
            </div>
          )}
          {v.gallery.length < 8 && (
            <UploadButton kind="image" label="Add photo" onUploaded={(url) => set("gallery", [...v.gallery, url])} />
          )}
        </div>

        <div className="space-y-2 rounded-xl border bg-card p-4">
          <Label>Sample PDF</Label>
          {v.samplePdf ? (
            <p className="flex items-center gap-2 text-sm">
              <FileText className="size-4 text-saffron-deep" />
              <a href={v.samplePdf} target="_blank" rel="noreferrer" className="truncate underline">
                View current sample
              </a>
              <Button type="button" variant="ghost" size="icon" className="ml-auto size-7" onClick={() => set("samplePdf", null)}>
                <X className="size-4" />
              </Button>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No sample uploaded.</p>
          )}
          <UploadButton kind="pdf" label={v.samplePdf ? "Replace PDF" : "Upload PDF"} onUploaded={(url) => set("samplePdf", url)} />
        </div>

        <div className="space-y-3 rounded-xl border bg-card p-4">
          {(
            [
              ["isVisible", "Visible in store"],
              ["isNewRelease", "Show in New Releases"],
              ["isFeatured", "Featured"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2.5 text-sm font-medium">
              <Checkbox
                checked={v[key]}
                onCheckedChange={(c) => set(key, c === true)}
              />
              {label}
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="submit" size="lg" className="flex-1 gap-2" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
          {v.id && (
            <Button type="button" size="lg" variant="outline" className="gap-2 text-destructive" onClick={remove}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </aside>
    </form>
  );
}
