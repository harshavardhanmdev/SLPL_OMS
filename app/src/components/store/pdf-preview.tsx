"use client";

import { Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function PdfPreview({ url, title }: { url: string; title: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="size-4 text-saffron-deep" /> Preview sample pages
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[85vh] flex-col sm:max-w-4xl">
        <DialogHeader className="flex-row items-center justify-between gap-4 space-y-0 pr-8">
          <DialogTitle className="line-clamp-1">{title} - sample pages</DialogTitle>
          <Button variant="outline" size="sm" asChild>
            <a href={url} download className="gap-1.5">
              <Download className="size-4" /> Download
            </a>
          </Button>
        </DialogHeader>
        <iframe src={url} title={`${title} sample PDF`} className="w-full flex-1 rounded-lg border bg-muted" />
      </DialogContent>
    </Dialog>
  );
}
