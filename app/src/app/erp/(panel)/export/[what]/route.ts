import { NextResponse } from "next/server";

import { csvResponse, day, rupees, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { BILLED_STATUSES } from "@/lib/ledger";
import { invoiceWhere, ownsSchool, salesTeam, schoolMoneyWhere, SCHOOLS_ONLY } from "@/lib/money-scope";
import { getStaff, roleCan } from "@/lib/staff-auth";
import { monthRange } from "@/lib/utils";

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
  const { what } = await params;
  // The CA has no sales screens but reads every bill and payment
  const allowed =
    staff &&
    (what === "invoices"
      ? roleCan(staff.role, "invoices.read")
      : what === "receipts"
        ? roleCan(staff.role, "finance.read") || roleCan(staff.role, "crm.read")
        : roleCan(staff.role, "crm.read"));
  if (!staff || !allowed) {
    return NextResponse.json({ error: "Not for you" }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const stamp = new Date().toISOString().slice(0, 10);
  // Sales download their own schools' money, not the whole company's
  const team = await salesTeam(staff);

  switch (what) {
    case "organizations": {
      // The same rows as the list: schools, or the owner's people billed directly
      const range = monthRange(url.searchParams.get("month"));
      const people = team === null && url.searchParams.get("kind") === "people";
      const rows = await db.organization.findMany({
        where: {
          ...(people ? { kind: "INDIVIDUAL" as const } : SCHOOLS_ONLY),
          ...(range ? { createdAt: range } : {}),
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
          ["Code", "Name", "Type", "Status", "Contact", "Designation", "Phone", "Email", "City",
           "State", "Board", "Students", "GSTIN", "Looked after by", "Source", "Referred by",
           "Visits", "Samples", "Gifts", "Billed", "Received", "Outstanding"],
          rows.map((o) => {
            const billed = o.invoices.reduce((s, i) => s + i.total, 0);
            const received = o.receipts.reduce((s, r) => s + r.amount, 0);
            const money = ownsSchool(team, o.ownerId)
              ? [rupees(billed), rupees(received), rupees(billed - received)]
              : ["", "", ""];
            return [o.code, o.name, o.kind, o.status, o.contactPerson, o.designation, o.phone,
              o.email, o.city, o.state, o.board, o.strength, o.gstin, o.owner?.name, o.source,
              o.referredBy, o._count.visits, o._count.samples, o._count.gifts, ...money];
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
      const range = monthRange(url.searchParams.get("month"));
      const rows = await db.invoice.findMany({
        where: { ...invoiceWhere(team), ...(range ? { invoiceDate: range } : {}) },
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
        where: schoolMoneyWhere(team),
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
          ["Taken", "Held by", "What", "Quantity", "Status", "Approval", "Sent back because",
           "School", "Code", "Given", "Returned", "Notes"],
          rows.map((s) => [day(s.issuedOn), s.issuedBy?.name ?? s.issuedEmail, s.description,
            s.quantity, s.status, s.approvalStatus, s.rejectedReason, s.organization?.name,
            s.organization?.code, day(s.givenOn), day(s.returnedOn), s.notes]),
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

    case "challans": {
      const rows = await db.deliveryChallan.findMany({
        orderBy: { dispatchedOn: "desc" },
        include: {
          organization: { select: { name: true } },
          invoice: { select: { number: true } },
          items: { orderBy: { sortOrder: "asc" } },
        },
      });
      return csvResponse(
        `challans-${stamp}.csv`,
        toCsv(
          ["Number", "Date", "School", "To", "Transporter", "Vehicle", "Invoice",
           "Total quantity", "Items"],
          rows.map((c) => [c.number, day(c.dispatchedOn), c.organization?.name, c.toName,
            c.transporter, c.vehicleNumber, c.invoice?.number,
            c.items.reduce((s, i) => s + i.quantity, 0),
            c.items.map((i) => `${i.description} x ${i.quantity} ${i.unit}`).join("; ")]),
        ),
      );
    }

    default:
      return NextResponse.json({ error: "Nothing to export by that name" }, { status: 404 });
  }
}
