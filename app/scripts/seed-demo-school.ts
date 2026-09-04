/**
 * Dev-only: one school, one kit and a small roster, so the kit flow can be
 * walked end to end without waiting for a real school's data.
 *
 * Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/seed-demo-school.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { hashPin } from "../src/lib/kit-staff-auth";
import { currentAcademicYear } from "../src/lib/kits";

const ROSTER = [
  "Aarav Sharma",
  "Diya Reddy",
  "Vihaan Rao",
  "Ananya Iyer",
  "Advik Naidu",
  "Ishita Kumar",
  "Reyansh Verma",
  "Saanvi Patel",
];

async function main() {
  const bundle = await db.product.findFirstOrThrow({
    where: { kind: "BUNDLE", bundleItems: { some: {} } },
    select: { id: true, title: true, gradeLabel: true },
  });

  const school = await db.school.upsert({
    where: { code: "DEMO-HYD" },
    update: { verifyPin: hashPin("2468") },
    create: {
      code: "DEMO-HYD",
      name: "Demo Public School",
      city: "Hyderabad",
      state: "Telangana",
      contactName: "Ramesh Mamidala",
      contactPhone: "9030390077",
      verifyPin: hashPin("2468"),
    },
  });

  const classLabel = bundle.gradeLabel ?? "Nursery";
  const year = currentAcademicYear();
  await db.schoolKit.upsert({
    where: {
      schoolId_academicYear_classLabel: { schoolId: school.id, academicYear: year, classLabel },
    },
    update: { productId: bundle.id, isActive: true },
    create: {
      schoolId: school.id,
      productId: bundle.id,
      academicYear: year,
      classLabel,
      collectionNote: "Collect from the school office, 9am to 3pm on working days.",
    },
  });

  for (const [i, fullName] of ROSTER.entries()) {
    const rollNumber = String(i + 1).padStart(2, "0");
    await db.student.upsert({
      where: {
        schoolId_classLabel_section_rollNumber: {
          schoolId: school.id,
          classLabel,
          section: "A",
          rollNumber,
        },
      },
      update: { fullName, isActive: true },
      create: { schoolId: school.id, fullName, classLabel, section: "A", rollNumber },
    });
  }

  console.log(`school ${school.code} (${school.name}), PIN 2468`);
  console.log(`kit: ${classLabel} ${year} -> ${bundle.title}`);
  console.log(`roster: ${ROSTER.length} students in ${classLabel} A`);
  console.log(`open http://localhost:3000/kits/${school.code}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
