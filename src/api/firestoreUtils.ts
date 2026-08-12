import { Timestamp } from "firebase/firestore";

/**
 * Convert a Firestore field that should be a timestamp into an ISO string.
 * Returns null for missing/pending values (e.g. a serverTimestamp() that
 * hasn't been resolved in a latency-compensated read).
 */
export function tsToIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}
