export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, School } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { KitCollectAction } from "@/components/store/kit-collect-action";
import { PrintButton } from "@/components/store/print-button";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/kit-staff-auth";
import { KIT_STATUS_META, receiptQrSvg } from "@/lib/kits";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Kit receipt", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

const dateIN = (d: Date) =>
  d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const badgeTone: Record<string, string> = {
  amber: "bg-saffron/20 text-saffron-deep border-saffron/40",
  blue: "bg-navy/10 text-navy border-navy/30 dark:text-foreground",
  green: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
  grey: "bg-muted text-muted-foreground border-border",
};

export default async function KitReceiptPage({ params }: Props) {
  const { token } = await params;

  const purchase = await db.kitPurchase.findUnique({
    where: { accessToken: token },
    include: {
      order: { select: { orderNumber: true, customerName: true, createdAt: true } },
      schoolKit: {
        select: {
          schoolId: true,
          academicYear: true,
          collectionNote: true,
          product: {
            include: { bundleItems: { include: { product: { select: { title: true } } } } },
          },
        },
      },
    },
  });
  if (!purchase) notFound();

  const [qr, staff] = await Promise.all([receiptQrSvg(purchase.accessToken), getStaffSession()]);
  const meta = KIT_STATUS_META[purchase.status] ?? { label: purchase.status, tone: "grey" as const };
  const staffOfThisSchool = staff?.schoolId === purchase.schoolKit.schoolId;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 print:py-0">
      <div className="rounded-2xl border bg-card print:border-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">
              SLPL STORE KIT RECEIPT
            </p>
            <h1 className="font-heading text-2xl font-bold">{purchase.receiptNumber}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Issued {dateIN(purchase.order.createdAt)}
            </p>
          </div>
          <Badge className={badgeTone[meta.tone]}>{meta.label}</Badge>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto]">
          <dl className="space-y-2.5 text-sm">
            <div>
              <dt className="text-muted-foreground">Student</dt>
              <dd className="font-heading text-lg font-semibold">{purchase.studentName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Class</dt>
              <dd className="font-medium">
                {purchase.classLabel} {purchase.section}
                {purchase.rollNumber ? ` · Roll ${purchase.rollNumber}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">School</dt>
              <dd className="font-medium">{purchase.schoolName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Academic year</dt>
              <dd className="font-medium">{purchase.schoolKit.academicYear}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Paid by</dt>
              <dd className="font-medium">
                {purchase.order.customerName} · order {purchase.order.orderNumber}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Amount paid</dt>
              <dd className="font-heading text-xl font-bold">{formatINR(purchase.amountPaid)}</dd>
            </div>
          </dl>

          <figure className="justify-self-center text-center">
            <div
              className="rounded-xl border bg-white p-2 [&>svg]:block"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <figcaption className="mt-2 max-w-[190px] text-xs text-muted-foreground">
              Show this at the school to collect the kit
            </figcaption>
          </figure>
        </div>

        <div className="border-t p-5">
          <h2 className="mb-3 text-sm font-semibold">
            {purchase.kitTitle} · {purchase.schoolKit.product.bundleItems.length} items
          </h2>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {purchase.schoolKit.product.bundleItems.map((item) => (
              <li key={item.id} className="flex gap-2 text-muted-foreground">
                <span className="text-saffron-deep">•</span>
                <span>
                  {item.product.title}
                  {item.quantity > 1 && ` × ${item.quantity}`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {purchase.status === "COLLECTED" ? (
          <div className="flex items-start gap-3 border-t bg-green-50 p-5 text-sm dark:bg-green-950/40">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-700 dark:text-green-400" />
            <div>
              <p className="font-medium">
                Collected on {purchase.collectedAt ? dateIN(purchase.collectedAt) : "record missing"}
              </p>
              {purchase.collectedBy && (
                <p className="text-muted-foreground">Handed over by {purchase.collectedBy}</p>
              )}
              <p className="mt-1 text-muted-foreground">
                This receipt has been used. It cannot be used to collect a second kit.
              </p>
            </div>
          </div>
        ) : purchase.status === "PENDING" ? (
          <div className="flex items-start gap-3 border-t bg-accent/60 p-5 text-sm">
            <Clock className="mt-0.5 size-5 shrink-0 text-saffron-deep" />
            <div>
              <p className="font-medium">Payment has not come through yet.</p>
              <p className="text-muted-foreground">
                The school cannot hand the kit over until this shows as paid.
              </p>
            </div>
          </div>
        ) : purchase.status === "CANCELLED" ? (
          <div className="border-t bg-muted/60 p-5 text-sm">
            <p className="font-medium">This purchase was cancelled.</p>
          </div>
        ) : (
          <div className="flex items-start gap-3 border-t p-5 text-sm">
            <School className="mt-0.5 size-5 shrink-0 text-saffron-deep" />
            <div>
              <p className="font-medium">Ready to collect at {purchase.schoolName}.</p>
              <p className="text-muted-foreground">
                {purchase.schoolKit.collectionNote ??
                  "Show this receipt at the school office to collect the kit."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 print:hidden">
        <PrintButton />
        <Link
          href="/account/kits"
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
        >
          My kits
        </Link>
      </div>

      {staffOfThisSchool && purchase.status !== "COLLECTED" && (
        <div className="mt-5 rounded-2xl border border-saffron/50 bg-accent/50 p-5 print:hidden">
          <p className="text-sm font-semibold">
            Signed in as school staff: {staff.staffName}, {staff.schoolName}
          </p>
          <p className="mt-0.5 mb-3 text-sm text-muted-foreground">
            Check the student&apos;s name against the receipt before handing the kit over.
          </p>
          <KitCollectAction accessToken={purchase.accessToken} status={purchase.status} />
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground print:hidden">
        Keep this link private. Anyone who has it can collect the kit.
      </p>
    </div>
  );
}
