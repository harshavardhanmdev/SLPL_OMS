// Thin re-export so estimate.ts has a single seam for the courier source.
// Swap this file's re-exports to change providers (e.g. direct BlueDart later).
export { isShiprocketConfigured, serviceability } from "@/lib/shipping/shiprocket";
