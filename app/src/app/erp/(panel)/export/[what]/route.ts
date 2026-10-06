import { NextResponse } from "next/server";

import { csvResponse, day, rupees, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { BILLED_STATUSES } from "@/lib/ledger";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const runtime = "nodejs";

/**
 * Everything sales do, as a spreadsheet.
 *
 * One route rather than seven, because the shape is always the same: check the
 * capability, pull the rows, hand back CSV. Filters arrive in the query string
 * so what is on screen is what comes down.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ what: string }> },
) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) {
    return NextResponse.json({ error: "Not for you" }, { status: 403 });
  }

  const { what } = await params;
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const stamp = new Date().toISOString().slice(0, 10);

  switch (what) {
    case "organizations": {
      const rows = await db.organization.findMany({
        where: {
          ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
          ...(status && status !== "all" ? { status: status as never } : {}),
        },
        orderBy: { name: "asc" },
        include: {
          owner: { select: { name: true } },
          invoices: { where: { status: { in: [...BILLED_STATUSES] } }, select: { total: true } },
          receipts: { where: { voidedAt: null }, select: { amount: true } },
          _count: { select: { visits: true, samples: true, gifts: true } },
        },
      });
      return csvResponse(
        `organisations-${stamp}.csv`,
        toCsv(
          ["Code", "Name", "Type", "Status", "Contact", "Phone", "Email", "City", "State",
           "GSTIN", "Looked after by", "Source", "Visits", "Samples", "Gifts",
           "Billed", "Received", "Outstanding"],
          rows.map((o) => {
            const billed = o.invoices.reduce((s, i) => s + i.total, 0);
            const received = o.receipts.reduce((s, r) => s + r.amount, 0);
            return [o.code, o.name, o.kind, o.status, o.contactPerson, o.phone, o.email, o.city,
              o.state, o.gstin, o.owner?.name, o.source, o._count.visits, o._count.samples,
              o._count.gifts, rupees(billed), rupees(received), rupees(billed - received)];
          }),
        ),
      );
    }

    case "visits": {
      const rows = await db.visit.findMany({
        orderBy: { visitedOn: "desc" },
        include: {
          organization: { select: { name: true, code: true } },
          by: { select: { name: true } },
          invoice: { select: { number: true, total: true } },
        },
      });
      return csvResponse(
        `visits-${stamp}.csv`,
        toCsv(
          ["Date", "School", "Code", "What", "Met", "Summary", "Outcome", "Next action",
           "Next action by", "By", "Converted", "Invoice", "Value"],
          rows.map((v) => [day(v.visitedOn), v.organization.name, v.organization.code, v.kind,
            v.metWith, v.summary, v.outcome, v.nextAction, day(v.nextActionOn), v.by?.name,
            v.converted ? "Yes" : "No", v.invoice?.number, rupees(v.invoice?.total)]),
        ),
      );
    }

    case "invoices": {
      const rows = await db.invoice.findMany({
        orderBy: { invoiceDate: "desc" },
        include: {
          createdBy: { select: { name: true } },
          allocations: { select: { amount: true } },
        },
      });
      return csvResponse(
        `invoices-${stamp}.csv`,
        toCsv(
          ["Number", "Type", "Status", "Date", "Due", "School", "GSTIN", "Place of supply",
           "Subtotal", "Discount", "Taxable", "CGST", "SGST", "IGST", "Total", "Received",
           "Outstanding", "Raised by"],
          rows.map((i) => {
            const received = i.allocations.reduce((s, a) => s + a.amount, 0);
            return [i.number, i.kind, i.status, day(i.invoiceDate), day(i.dueDate), i.customerName,
              i.gstin, i.placeOfSupply, rupees(i.subtotal), rupees(i.discount), rupees(i.taxable),
              rupees(i.cgst), rupees(i.sgst), rupees(i.igst), rupees(i.total), rupees(received),
              rupees(i.total - received), i.createdBy?.name];
          }),
        ),
      );
    }

    case "quotations": {
      const rows = await db.quotation.findMany({
        orderBy: { quotedOn: "desc" },
        include: { createdBy: { select: { name: true } } },
      });
      return csvResponse(
        `quotations-${stamp}.csv`,
        toCsv(
          ["Number", "Status", "Date", "Valid until", "Customer", "Place of supply",
           "Taxable", "CGST", "SGST", "IGST", "Total", "Raised by"],
          rows.map((q) => [q.number, q.status, day(q.quotedOn), day(q.validUntil), q.customerName,
            q.placeOfSupply, rupees(q.taxable), rupees(q.cgst), rupees(q.sgst), rupees(q.igst),
            rupees(q.total), q.createdBy?.name]),
        ),
      );
    }

    case "receipts": {
      const rows = await db.receipt.findMany({
        orderBy: { receivedOn: "desc" },
        include: {
          organization: { select: { name: true, code: true } },
          allocations: { include: { invoice: { select: { number: true } } } },
        },
      });
      return csvResponse(
        `payments-${stamp}.csv`,
        toCsv(
          ["Number", "Date", "School", "Code", "Amount", "Mode", "Reference", "Against", "Void"],
          rows.map((r) => [r.number, day(r.receivedOn), r.organization.name, r.organization.code,
            rupees(r.amount), r.mode, r.reference,
            r.allocations.map((a) => a.invoice.number).join(" "),
            r.voidedAt ? `Voided: ${r.voidReason ?? ""}` : ""]),
        ),
      );
    }

    case "samples": {
      const rows = await db.sampleIssue.findMany({
        orderBy: { issuedOn: "desc" },
        include: {
          organization: { select: { name: true, code: true } },
          issuedBy: { select: { name: true } },
        },
      });
      return csvResponse(
        `samples-${stamp}.csv`,
        toCsv(
          ["Date", "School", "Code", "What", "Quantity", "Status", "Returned", "By", "Notes"],
          rows.map((s) => [day(s.issuedOn), s.organization.name, s.organization.code,
            s.description, s.quantity, s.status, day(s.returnedOn), s.issuedBy?.name, s.notes]),
        ),
      );
    }

    case "gifts": {
      const rows = await db.gift.findMany({
        orderBy: { givenOn: "desc" },
        include: {
          organization: { select: { name: true, code: true } },
          givenBy: { select: { name: true } },
        },
      });
      return csvResponse(
        `gifts-${stamp}.csv`,
        toCsv(
          ["Date", "School", "Code", "What", "To", "Value", "By", "Notes"],
          rows.map((g) => [day(g.givenOn), g.organization.name, g.organization.code,
            g.description, g.givenToName, rupees(g.value), g.givenBy?.name, g.notes]),
        ),
      );
    }

    default:
      return NextResponse.json({ error: "Nothing to export by that name" }, { status: 404 });
  }
}
