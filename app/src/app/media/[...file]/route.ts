import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

/** Serves admin-uploaded media from the uploads volume with long-lived caching. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string[] }> },
) {
  const { file } = await params;
  const name = file.join("/");

  // Filenames are server-generated - anything outside [a-z0-9.-] is hostile
  if (!/^[a-z0-9][a-z0-9.-]*$/i.test(name) || name.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ext = path.extname(name).toLowerCase();
  const type = TYPES[ext];
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = path.join(UPLOADS_DIR, name);
  try {
    const info = await stat(filePath);
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
