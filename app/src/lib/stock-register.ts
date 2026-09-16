/**
 * What a "set" actually contains.
 *
 * The physical register counts sets, but an auditor reconciling a shelf counts
 * copies. One Grade 3 set leaving the godown is six books off the shelf, and
 * without that expansion the register cannot be checked against anything.
 *
 * Telugu and Hindi sit outside the Little Leaps set, because a school can take
 * the core set without a language book, which is exactly why the handwritten
 * register tracks them in their own column.
 */

export type SetMember = { sku: string; subject: string };

const LL_SUBJECTS: [string, string][] = [
  ["ENG", "English"],
  ["MAT", "Maths"],
  ["SCI", "Science"],
  ["SOC", "Social Studies"],
  ["COM", "Computer"],
  ["GKB", "General Knowledge"],
];

const SKB_LOWER: [string, string][] = [
  ["ENG", "English"],
  ["MAT", "Maths"],
  ["GSC", "General Science"],
  ["SOC", "Social Studies"],
];

const SKB_UPPER: [string, string][] = [
  ["ENG", "English"],
  ["MAT", "Maths"],
  ["PHY", "Physics"],
  ["BIO", "Biology"],
  ["SOC", "Social Studies"],
];

/** Baby Steps sets are counted whole, language books included. */
const BABY_STEPS: Record<string, { level: number; members: [string, string][] }> = {
  Nursery: {
    level: 1,
    members: [
      ["TEL", "Telugu"],
      ["ECB", "English Course Book"],
      ["EWB", "English Work Book"],
      ["MCB", "Maths Course Book"],
      ["MWB", "Maths Work Book"],
      ["EVCB", "EVS Course Book"],
      ["EVWB", "EVS Work Book"],
      ["DRW", "Drawing"],
      ["LNP", "Lines and Patterns"],
      ["RYS", "Rhymes and Songs"],
    ],
  },
  LKG: {
    level: 2,
    members: [
      ["TEL", "Telugu"],
      ["ECB", "English Course Book"],
      ["EWB", "English Work Book"],
      ["MCB", "Maths Course Book"],
      ["MWB", "Maths Work Book"],
      ["EVCB", "EVS Course Book"],
      ["EVWB", "EVS Work Book"],
      ["DRW", "Drawing"],
      ["LNP", "Lines and Patterns"],
      ["RYS", "Rhymes and Songs"],
      ["HIN", "Hindi"],
    ],
  },
  UKG: {
    level: 3,
    members: [
      ["TEL", "Telugu"],
      ["ECB", "English Course Book"],
      ["EWB", "English Work Book"],
      ["MCB", "Maths Course Book"],
      ["MWB", "Maths Work Book"],
      ["EVCB", "EVS Course Book"],
      ["EVWB", "EVS Work Book"],
      ["DRW", "Drawing"],
      ["RYS", "Rhymes and Songs"],
      ["HIN", "Hindi"],
    ],
  },
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The titles inside one set of the given register row, in register order. */
export function setComposition(label: string): SetMember[] {
  const baby = BABY_STEPS[label];
  if (baby) {
    return baby.members.map(([subject, name], i) => ({
      sku: `BS${baby.level}${subject}${pad2(i + 1)}`,
      subject: name,
    }));
  }

  const grade = Number(/(\d+)/.exec(label)?.[1] ?? NaN);
  if (grade >= 1 && grade <= 5) {
    return LL_SUBJECTS.map(([subject, name]) => ({ sku: `LL${grade}${subject}01`, subject: name }));
  }
  if (grade >= 6 && grade <= 10) {
    const table = grade <= 7 ? SKB_LOWER : SKB_UPPER;
    return table.map(([subject, name]) => ({ sku: `SKB${grade - 5}${subject}01`, subject: name }));
  }
  return [];
}

/** Language titles tracked outside the set, for the rows that do that. */
export function languageComposition(label: string): { telugu?: SetMember; hindi?: SetMember } {
  const grade = Number(/(\d+)/.exec(label)?.[1] ?? NaN);
  if (grade >= 1 && grade <= 5) {
    return {
      telugu: { sku: `LL${grade}TEL01`, subject: "Telugu" },
      hindi: { sku: `LL${grade}HIN01`, subject: "Hindi" },
    };
  }
  return {};
}

export type RegisterRow = {
  label: string;
  series?: string;
  sku?: string;
  unit: "SET" | "COPY";
  inward: number;
  outward: number;
  inventory: number;
  inwardTelugu?: number | null;
  inwardHindi?: number | null;
  outwardTelugu?: number | null;
  outwardHindi?: number | null;
  inventoryTelugu?: number | null;
  inventoryHindi?: number | null;
  carriedForward?: number | null;
  extra?: number | null;
  note?: string | null;
};

/** Copies behind a row: sets times titles, plus the language books counted apart. */
export function copiesFor(row: RegisterRow) {
  if (row.unit === "COPY") {
    return { inward: row.inward, outward: row.outward, inventory: row.inventory, titles: 1 };
  }
  const titles = setComposition(row.label).length;
  return {
    inward: row.inward * titles + (row.inwardTelugu ?? 0) + (row.inwardHindi ?? 0),
    outward: row.outward * titles + (row.outwardTelugu ?? 0) + (row.outwardHindi ?? 0),
    inventory: row.inventory * titles + (row.inventoryTelugu ?? 0) + (row.inventoryHindi ?? 0),
    titles,
  };
}
