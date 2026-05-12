import type { Component } from "../types/project";

/**
 * Adjust component index ranges after a text edit.
 *
 * editStart..editEnd is the range (in the OLD text) that was replaced
 * by a string of length newLength.
 *
 * Rules:
 * - Components entirely BEFORE the edit: unchanged.
 * - Components entirely AFTER the edit: shift both indices by delta.
 * - Edit fully INSIDE a component: extend/shrink the component's end.
 * - Component crosses an edit boundary: destroyed (returned omitted) —
 *   the user has edited across a component edge, which would corrupt
 *   the styling; safest is to drop it.
 */
export function adjustRanges(
  components: Component[],
  editStart: number,
  editEnd: number,
  newLength: number,
): Component[] {
  const delta = newLength - (editEnd - editStart);
  const result: Component[] = [];

  for (const c of components) {
    if (c.endIndex <= editStart) {
      result.push(c);
      continue;
    }
    if (c.startIndex >= editEnd) {
      result.push({
        ...c,
        startIndex: c.startIndex + delta,
        endIndex: c.endIndex + delta,
      });
      continue;
    }
    if (c.startIndex <= editStart && c.endIndex >= editEnd) {
      const newEnd = c.endIndex + delta;
      if (newEnd <= c.startIndex) continue;
      result.push({ ...c, endIndex: newEnd });
      continue;
    }
    // Component overlaps the edit boundary — destroy it.
  }

  return result;
}

/**
 * Check whether a candidate range [start, end) overlaps any existing
 * component. Used before allowing the user to create a new component.
 */
export function rangeOverlapsAny(
  components: Component[],
  start: number,
  end: number,
): boolean {
  for (const c of components) {
    if (start < c.endIndex && end > c.startIndex) return true;
  }
  return false;
}
