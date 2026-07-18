"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

/** Consignment number chip with one-tap copy, for pasting into the courier's tracking page. */
export function AwbCopy({ awb }: { awb: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(awb);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (http / old browser) - the number is still selectable text
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border bg-secondary/60 px-2.5 py-1 font-mono text-sm font-semibold tracking-wide transition-colors hover:border-saffron/60 dark:bg-card"
      title="Copy tracking number"
    >
      {awb}
      {copied ? (
        <Check className="size-3.5 text-green-700 dark:text-green-400" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground" />
      )}
    </button>
  );
}
