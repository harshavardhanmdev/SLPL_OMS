"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { hashPin } from "@/lib/kit-staff-auth";
import { currentAcademicYear } from "@/lib/kits";

/** Admin side of school kits: schools, kit configuration, rosters, handover. */

type Result = { ok?: boolean; error?: string; id?: string };

async function ensureAdmin(): Promise<string | null> {
  return (await isAdmin()) ? null : "UNAUTHORIZED";
}

// ── Schools ──────────────────────────────────────────────────────────────────

const schoolSchema = z.object({
  id: z.string().optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, "Code: 2-20 letters, numbers or hyphens"),
  name: z.string().trim().min(3, "Enter the school name").max(120),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().min(2).max(60),
  udiseCode: z.string().trim().max(20).optional().or(z.literal("")),
  contactName: z.string().trim().max(80).optional().or(z.literal("")),
  contactPhone: z.string().trim().max(20).optional().or(z.literal("")),
  contactEmail: z.string().trim().max(120).optional().or(z.literal("")),
  isActive: z.boolean(),
});

export type SchoolInput = z.infer<typeof schoolSchema>;

export async function saveSchool(input: SchoolInput): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const parsed = schoolSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const clash = await db.school.findFirst({
    where: { code: d.code, ...(d.id ? { NOT: { id: d.id } } : {}) },
    select: { name: true },
  });
  if (clash) return { error: `Code ${d.code} is already used by ${clash.name}.` };

  const data = {
    code: d.code,
    name: d.name,
    city: d.city,
    state: d.state,
    udiseCode: d.udiseCode || null,
    contactName: d.contactName || null,
    contactPhone: d.contactPhone || null,
    contactEmail: d.contactEmail || null,
    isActive: d.isActive,
  };
  const row = d.id
    ? await db.school.update({ where: { id: d.id }, data })
    : await db.school.create({ data });

  revalidatePath("/admin/kits/schools");
  return { ok: true, id: row.id };
}

/**
 * Sets the PIN school staff type on the verification screen. Stored as a
 * bcrypt hash, and returned once in plain text so the owner can pass it on:
 * after this it is unreadable, exactly like the admin password.
 */
export async function setSchoolPin(schoolId: string, pin: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  if (!/^[0-9]{4,8}$/.test(pin.trim())) return { error: "PIN must be 4 to 8 digits." };
  await db.school.update({ where: { id: schoolId }, data: { verifyPin: hashPin(pin.trim()) } });
  revalidatePath(`/admin/kits/schools/${schoolId}`);
  return { ok: true };
}

// ── Kits ─────────────────────────────────────────────────────────────────────

const kitSchema = z.object({
  id: z.string().optional(),
  schoolId: z.string().min(1),
  productId: z.string().min(1, "Pick the kit product"),
  academicYear: z
    .string()
    .trim()
    .regex(/^20[0-9]{2}-[0-9]{2}$/, "Academic year looks like 2026-27"),
  classLabel: z.string().trim().min(1, "Enter the class").max(40),
  collectionNote: z.string().trim().max(300).optional().or(z.literal("")),
  isActive: z.boolean(),
});

export type SchoolKitInput = z.infer<typeof kitSchema>;

export async function saveSchoolKit(input: SchoolKitInput): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const parsed = kitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const product = await db.product.findUnique({
    where: { id: d.productId },
    select: { kind: true, bundleItems: { select: { id: true } } },
  });
  if (!product) return { error: "That product no longer exists." };
  if (product.kind !== "BUNDLE") {
    return { error: "A kit must point at a bundle product, so its contents and stock are real." };
  }
  if (product.bundleItems.length === 0) {
    return { error: "That bundle has no books in it yet. Add its contents first." };
  }

  const clash = await db.schoolKit.findFirst({
    where: {
      schoolId: d.schoolId,
      academicYear: d.academicYear,
      classLabel: d.classLabel,
      ...(d.id ? { NOT: { id: d.id } } : {}),
    },
  });
  if (clash) return { error: `${d.classLabel} already has a kit for ${d.academicYear}.` };

  const data = {
    schoolId: d.schoolId,
    productId: d.productId,
    academicYear: d.academicYear,
    classLabel: d.classLabel,
    collectionNote: d.collectionNote || null,
    isActive: d.isActive,
  };
  const row = d.id
    ? await db.schoolKit.update({ where: { id: d.id }, data })
    : await db.schoolKit.create({ data });

  revalidatePath(`/admin/kits/schools/${d.schoolId}`);
  return { ok: true, id: row.id };
}

export async function deleteSchoolKit(id: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const sold = await db.kitPurchase.count({ where: { schoolKitId: id } });
  if (sold > 0) return { error: "Kits have already been sold for this class - deactivate it instead." };
  const kit = await db.schoolKit.delete({ where: { id } });
  revalidatePath(`/admin/kits/schools/${kit.schoolId}`);
  return { ok: true };
}

// ── Roster ───────────────────────────────────────────────────────────────────

export type RosterImportResult = {
  error?: string;
  added?: number;
  updated?: number;
  skipped?: { line: number; reason: string }[];
};

/**
 * CSV roster import: full name, class, section, roll number, guardian phone.
 *
 * Student rosters are children's data. We hold only what a handover needs, and
 * the school's consent is the owner's responsibility to obtain before pasting
 * anything here. purgeRoster clears a school at the end of the year.
 */
export async function importRoster(schoolId: string, csv: string): Promise<RosterImportResult> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };

  const school = await db.school.findUnique({ where: { id: schoolId }, select: { id: true } });
  if (!school) return { error: "School not found." };

  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length === 0) return { error: "Nothing to import." };
  if (rows.length > 2000) return { error: "Import at most 2000 rows at a time." };

  // Drop a header row if the file has one
  const first = rows[0].toLowerCase();
  const body = first.includes("name") && first.includes("class") ? rows.slice(1) : rows;

  let added = 0;
  let updated = 0;
  const skipped: { line: number; reason: string }[] = [];
  const seen = new Set<string>();

  for (const [index, line] of body.entries()) {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const [fullName, classLabel, sectionRaw, rollRaw, phoneRaw] = cells;
    const lineNo = index + 1 + (body.length === rows.length ? 0 : 1);

    if (!fullName || !classLabel) {
      skipped.push({ line: lineNo, reason: "needs at least a name and a class" });
      continue;
    }
    const section = (sectionRaw || "A").toUpperCase().slice(0, 8);
    const rollNumber = rollRaw || `${classLabel}-${section}-${index + 1}`;
    const guardianPhone = /^[6-9][0-9]{9}$/.test(phoneRaw ?? "") ? phoneRaw : null;

    const key = `${classLabel}|${section}|${rollNumber}`.toLowerCase();
    if (seen.has(key)) {
      skipped.push({ line: lineNo, reason: `duplicate roll number ${rollNumber} in this file` });
      continue;
    }
    seen.add(key);

    const existing = await db.student.findUnique({
      where: {
        schoolId_classLabel_section_rollNumber: { schoolId, classLabel, section, rollNumber },
      },
      select: { id: true },
    });
    if (existing) {
      await db.student.update({
        where: { id: existing.id },
        data: { fullName: fullName.slice(0, 80), guardianPhone, isActive: true },
      });
      updated += 1;
    } else {
      await db.student.create({
        data: {
          schoolId,
          fullName: fullName.slice(0, 80),
          classLabel: classLabel.slice(0, 40),
          section,
          rollNumber: rollNumber.slice(0, 20),
          guardianPhone,
        },
      });
      added += 1;
    }
  }

  revalidatePath(`/admin/kits/schools/${schoolId}`);
  return { added, updated, skipped };
}

/**
 * End-of-year cleanup. Students who bought a kit are deactivated rather than
 * deleted, because their receipt has to stay traceable; the rest go.
 */
export async function purgeRoster(schoolId: string, confirmName: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const school = await db.school.findUnique({ where: { id: schoolId }, select: { name: true } });
  if (!school) return { error: "School not found." };
  if (confirmName.trim() !== school.name) {
    return { error: "Type the school name exactly to confirm the purge." };
  }

  const withPurchases = await db.student.findMany({
    where: { schoolId, purchases: { some: {} } },
    select: { id: true },
  });
  await db.student.updateMany({
    where: { id: { in: withPurchases.map((s) => s.id) } },
    data: { isActive: false },
  });
  const removed = await db.student.deleteMany({
    where: { schoolId, id: { notIn: withPurchases.map((s) => s.id) } },
  });

  revalidatePath(`/admin/kits/schools/${schoolId}`);
  return {
    ok: true,
    error: undefined,
    id: `${removed.count} removed, ${withPurchases.length} kept for their receipts`,
  };
}

// ── Handover from the admin side ─────────────────────────────────────────────

export async function markKitReady(purchaseId: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const res = await db.kitPurchase.updateMany({
    where: { id: purchaseId, status: "PAID" },
    data: { status: "READY" },
  });
  if (res.count === 0) return { error: "Only a paid kit can be set aside as ready." };
  await db.kitCollectionEvent.create({
    data: { purchaseId, status: "READY", note: "Set aside at the school" },
  });
  revalidatePath("/admin/kits");
  return { ok: true };
}

export async function markKitCollectedByAdmin(
  purchaseId: string,
  collectedBy: string,
): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const name = collectedBy.trim().slice(0, 60);
  if (name.length < 2) return { error: "Enter who collected the kit." };

  const res = await db.kitPurchase.updateMany({
    where: { id: purchaseId, status: { in: ["PAID", "READY"] } },
    data: { status: "COLLECTED", collectedAt: new Date(), collectedBy: name },
  });
  if (res.count === 0) return { error: "This kit is not awaiting collection." };
  await db.kitCollectionEvent.create({
    data: { purchaseId, status: "COLLECTED", note: `Handed over to ${name}, recorded by the store` },
  });
  revalidatePath("/admin/kits");
  return { ok: true };
}

export async function defaultAcademicYear(): Promise<string> {
  return currentAcademicYear();
}
