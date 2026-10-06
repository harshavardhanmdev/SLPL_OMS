import "server-only";

/**
 * CSV, which Excel opens without anyone installing anything and without this
 * project taking on a spreadsheet library for the sake of a download button.
 */

/**
 * One field, quoted when it has to be.
 *
 * A leading `=`, `+`, `-` or `@` is prefixed with a quote, because Excel reads
 * those as formulas. A school called "=Sun School" should not execute when the
 * file is opened.
 */
function cell(value: unknown): string {
  if (value == null) return "";
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  // A BOM, so Excel reads rupee signs and Telugu names as UTF-8 rather than mojibake
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Paise to a plain number Excel can sum, rather than a formatted string. */
export function rupees(paise: number | null | undefined): string {
  return paise == null ? "" : (paise / 100).toFixed(2);
}

export function day(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
