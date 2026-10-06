/**
 * Adds the Faculty Development Programme and Student Counselling as services,
 * priced at Rs 25,000 each plus 18% GST under SAC 9992, so they can be quoted
 * and billed from the picker.
 *
 * They also appear on the public /services page, like every visible service.
 * The wording is deliberately plain; edit it in /admin/services.
 *
 * Targeted on purpose, per the rule against running the full seed on
 * production. Idempotent: an existing page keeps its wording and only has its
 * price set.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/add-fdp-counselling-services.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";

const SERVICES = [
  {
    slug: "faculty-development",
    title: "Faculty Development Programme",
    tagline: "Professional development for your teaching staff",
    description:
      "Sessions for teachers delivered at your school by the SLPL academic team, shaped around what your staff need, from classroom communication to activity-based teaching.",
    sortOrder: 5,
  },
  {
    slug: "student-counselling",
    title: "Student Counselling",
    tagline: "Guidance for students at the moments that matter",
    description:
      "Counselling sessions for students at your school on study habits, exam pressure and choosing a stream or a career, run with your teachers.",
    sortOrder: 6,
  },
];

async function main() {
  for (const s of SERVICES) {
    const existing = await db.servicePage.findUnique({ where: { slug: s.slug } });
    const pricing = { price: 25_000 * 100, gstRate: 1800, hsnCode: "9992" };
    if (existing) {
      await db.servicePage.update({ where: { id: existing.id }, data: pricing });
      console.log(`  ok  ${existing.title}: already there, priced`);
    } else {
      await db.servicePage.create({
        data: { ...s, ...pricing, bannerImage: null, externalUrl: "https://theslpl.in", isVisible: true },
      });
      console.log(`  ok  ${s.title}: added at Rs 25,000 plus 18% GST`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
