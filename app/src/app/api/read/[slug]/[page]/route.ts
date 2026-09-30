import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { getSession } from "@/lib/auth";
import { WatermarkError, findLicence, recordView, renderPage } from "@/lib/digital-access";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * One page of a digital edition, watermarked for the reader asking for it.
 *
 * Nothing here is cacheable and nothing is shareable: a URL pasted to a friend
 * hits the entitlement check and gets a 403. The page images live in the
 * uploads volume, never in the repo, which is public.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; page: string }> },
) {
  const { slug, page: rawPage } = await params;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to read" }, { status: 401 });

  const page = Number(rawPage);
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "No such page" }, { status: 404 });
  }

  // Two windows: the tight one stops a scraping loop, the loose one still lets
  // somebody read an issue cover to cover in one sitting.
  if (
    !rateLimit(`read-burst:${session.uid}`, 15, 10_000) ||
    !rateLimit(`read:${session.uid}`, 200, 5 * 60_000)
  ) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const licence = await findLicence(session.uid, slug);
  if (!licence) return NextResponse.json({ error: "Not your copy" }, { status: 403 });
  if (page > licence.pageCount) {
    return NextResponse.json({ error: "No such page" }, { status: 404 });
  }

  let body: Buffer;
  try {
    body = await renderPage(licence, page);
  } catch (err) {
    console.error("[digital] could not render", slug, page, err);
    // An unmarked page is worse than no page, so a broken watermark is an
    // outage rather than something we quietly paper over.
    if (err instanceof WatermarkError) {
      return NextResponse.json({ error: "Reading is temporarily unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "That page is missing" }, { status: 404 });
  }

  const h = await headers();
  recordView(
    licence.entitlementId,
    page,
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    h.get("user-agent"),
  );

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(body.length),
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": "inline",
      "X-Robots-Tag": "noindex, noimageindex",
    },
  });
}
