import { describe, it, expect } from "vitest";
import { adjustRanges, rangeOverlapsAny } from "../ranges";
import type { Component } from "../../types/project";

const c = (id: string, start: number, end: number): Component => ({
  id,
  startIndex: start,
  endIndex: end,
  color: "hsl(210, 80%, 60%)",
  style: {
    fontFamily: "system-ui",
    fontSize: 48,
    fontWeight: 600,
    color: "#fff",
    letterSpacing: 0,
    x: 0,
    y: 0,
    opacity: 1,
    scale: 1,
    rotation: 0,
  },
  effects: [],
});

describe("adjustRanges", () => {
  it("leaves components entirely before the edit untouched", () => {
    const before = [c("a", 0, 5)];
    const after = adjustRanges(before, 10, 12, 4);
    expect(after).toEqual(before);
  });

  it("shifts components entirely after the edit by delta", () => {
    const before = [c("a", 20, 25)];
    const after = adjustRanges(before, 5, 10, 8); // delta = +3
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ startIndex: 23, endIndex: 28 });
  });

  it("negative delta also shifts later components", () => {
    const before = [c("a", 20, 25)];
    const after = adjustRanges(before, 5, 10, 2); // delta = -3
    expect(after[0]).toMatchObject({ startIndex: 17, endIndex: 22 });
  });

  it("extends a component when edit happens inside it", () => {
    // Component covers chars 5..15, edit replaces 8..10 (2 chars) with 6 chars (delta +4)
    const before = [c("a", 5, 15)];
    const after = adjustRanges(before, 8, 10, 6);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ startIndex: 5, endIndex: 19 });
  });

  it("shrinks a component when an internal edit deletes chars", () => {
    const before = [c("a", 5, 15)];
    const after = adjustRanges(before, 8, 12, 0); // delta = -4
    expect(after[0]).toMatchObject({ startIndex: 5, endIndex: 11 });
  });

  it("destroys a component when an edit crosses its left boundary", () => {
    const before = [c("a", 5, 10)];
    const after = adjustRanges(before, 3, 7, 2);
    expect(after).toHaveLength(0);
  });

  it("destroys a component when an edit crosses its right boundary", () => {
    const before = [c("a", 5, 10)];
    const after = adjustRanges(before, 8, 12, 2);
    expect(after).toHaveLength(0);
  });

  it("destroys a component when an internal edit deletes all its content", () => {
    const before = [c("a", 5, 10)];
    const after = adjustRanges(before, 5, 10, 0);
    expect(after).toHaveLength(0);
  });

  it("handles a mix of before/inside/after in one edit", () => {
    const before = [c("before", 0, 3), c("inside", 5, 10), c("after", 15, 20)];
    // Edit at 6..8 (2 chars) → replaced with 5 chars (delta +3)
    const after = adjustRanges(before, 6, 8, 5);
    expect(after).toHaveLength(3);
    expect(after.find((x) => x.id === "before")).toMatchObject({
      startIndex: 0,
      endIndex: 3,
    });
    expect(after.find((x) => x.id === "inside")).toMatchObject({
      startIndex: 5,
      endIndex: 13,
    });
    expect(after.find((x) => x.id === "after")).toMatchObject({
      startIndex: 18,
      endIndex: 23,
    });
  });

  it("treats an insertion-only edit (editStart == editEnd) correctly", () => {
    // Insert 4 chars at position 10, no deletion. delta = +4.
    const before = [c("before", 0, 5), c("after", 12, 20)];
    const after = adjustRanges(before, 10, 10, 4);
    expect(after.find((x) => x.id === "before")).toMatchObject({
      startIndex: 0,
      endIndex: 5,
    });
    expect(after.find((x) => x.id === "after")).toMatchObject({
      startIndex: 16,
      endIndex: 24,
    });
  });

  it("an insertion AT a component's right boundary does NOT enter it", () => {
    // Component covers 5..10. Insertion at 10 (editStart=editEnd=10).
    // The blueprint says boundary crossings should destroy; but a pure
    // insertion at the exact right edge is treated as 'after', not crossing.
    const before = [c("a", 5, 10)];
    const after = adjustRanges(before, 10, 10, 3);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ startIndex: 5, endIndex: 10 });
  });
});

describe("rangeOverlapsAny", () => {
  it("returns false for an empty list", () => {
    expect(rangeOverlapsAny([], 0, 5)).toBe(false);
  });

  it("detects overlap when a candidate range straddles a component", () => {
    expect(rangeOverlapsAny([c("a", 5, 10)], 3, 7)).toBe(true);
  });

  it("returns false for ranges that abut but do not overlap", () => {
    expect(rangeOverlapsAny([c("a", 5, 10)], 10, 15)).toBe(false);
    expect(rangeOverlapsAny([c("a", 5, 10)], 0, 5)).toBe(false);
  });

  it("returns true for a candidate range fully inside a component", () => {
    expect(rangeOverlapsAny([c("a", 5, 10)], 6, 9)).toBe(true);
  });
});
