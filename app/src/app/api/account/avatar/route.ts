import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");

/** Customer profile photo: any image in, 256px webp out. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Send a file" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large (max 5 MB)" }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const out = await sharp(buffer, { failOn: "error" })
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
    await mkdir(UPLOADS_DIR, { recursive: true });
    const name = `avatar-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.webp`;
    await writeFile(path.join(UPLOADS_DIR, name), out);
    const url = `/media/${name}`;
    await db.user.update({ where: { id: session.uid }, data: { image: url } });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Not a valid image" }, { status: 415 });
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.user.update({ where: { id: session.uid }, data: { image: null } });
  return NextResponse.json({ ok: true });
}
