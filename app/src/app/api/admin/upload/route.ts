import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";

import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 30 * 1024 * 1024;

/**
 * Admin media uploads. Images are re-encoded to WebP via sharp (strips any
 * embedded payloads and normalises size); PDFs are magic-byte checked.
 * Files land in UPLOADS_DIR (a Docker volume in prod) and are served by
 * /media/[...file].
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File) || (kind !== "image" && kind !== "pdf")) {
    return NextResponse.json({ error: "Send multipart form-data with file + kind" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await mkdir(UPLOADS_DIR, { recursive: true });
  const stamp = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;

  if (kind === "image") {
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 413 });
    }
    try {
      const name = `${stamp}.webp`;
      const out = await sharp(buffer, { failOn: "error" })
        .rotate()
        .resize({ width: 1400, height: 1867, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 84 })
        .toBuffer();
      await writeFile(path.join(UPLOADS_DIR, name), out);
      return NextResponse.json({ url: `/media/${name}` });
    } catch {
      return NextResponse.json({ error: "Not a valid image file" }, { status: 415 });
    }
  }

  // PDF
  if (buffer.byteLength > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF too large (max 30 MB)" }, { status: 413 });
  }
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "Not a valid PDF file" }, { status: 415 });
  }
  const name = `${stamp}.pdf`;
  await writeFile(path.join(UPLOADS_DIR, name), buffer);
  return NextResponse.json({ url: `/media/${name}` });
}
