import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A post-sign-in destination, kept only if it stays on this site. Browsers
 * strip tabs and newlines and read a backslash as a slash, so "/\t/evil.com"
 * and "/\evil.com" would both leave; anything but a plain path is refused.
 */
export function safeRelativePath(raw: unknown, fallback: string): string {
  return typeof raw === "string" && /^\/(?![/\\])[^\s\\]*$/.test(raw) ? raw : fallback
}

/**
 * Today as yyyy-mm-dd on the device's own clock. toISOString() is UTC, which
 * in India shows yesterday until half past five in the morning.
 */
export function todayLocalIso(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** A date's month as yyyy-mm, for dividing a list by month. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** 2026-10 -> October 2026 */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
}

/** The dates inside a yyyy-mm month, or undefined when it is not one. */
export function monthRange(key: string | null | undefined): { gte: Date; lt: Date } | undefined {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return undefined
  const [y, m] = key.split("-").map(Number)
  return { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) }
}
