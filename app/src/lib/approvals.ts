import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { roleCan, type StaffSession } from "@/lib/staff-auth";

/**
 * What is waiting on this person. An approver sees everything raised for
 * approval; anyone else sees what was sent back to them to fix.
 *
 * One place for the filters, so the menu badge and the inbox never disagree.
 */
export function approvalFilters(staff: StaffSession): {
  approver: boolean;
  quotation: Prisma.QuotationWhereInput;
  invoice: Prisma.InvoiceWhereInput;
  sample: Prisma.SampleIssueWhereInput;
} {
  if (roleCan(staff.role, "invoices.approve")) {
    return {
      approver: true,
      quotation: { status: "PENDING_APPROVAL" },
      invoice: { status: "PENDING_APPROVAL" },
      sample: { approvalStatus: "PENDING" },
    };
  }
  return {
    approver: false,
    quotation: { createdById: staff.id, status: "DRAFT", rejectedReason: { not: null } },
    invoice: { createdById: staff.id, status: "DRAFT", rejectedReason: { not: null } },
    // Once sent-back copies are returned or written off there is nothing left to fix
    sample: {
      issuedById: staff.id,
      approvalStatus: "REJECTED",
      status: { in: ["IN_HAND", "WITH_SCHOOL"] },
    },
  };
}

/** The number on the menu badge. */
export async function approvalCount(staff: StaffSession): Promise<number> {
  const f = approvalFilters(staff);
  const [q, i, s] = await Promise.all([
    db.quotation.count({ where: f.quotation }),
    db.invoice.count({ where: f.invoice }),
    db.sampleIssue.count({ where: f.sample }),
  ]);
  return q + i + s;
}
