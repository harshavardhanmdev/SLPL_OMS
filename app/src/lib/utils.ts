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
