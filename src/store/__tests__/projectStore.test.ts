import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "../projectStore";
import { makeSampleProject } from "../../sample/sampleProject";

describe("projectStore", () => {
  beforeEach(() => {
    // Clear localStorage so initialProject() doesn't carry test bleed.
    if (typeof window !== "undefined") window.localStorage.clear();
    useProjectStore.setState({ project: makeSampleProject() });
  });

  describe("splitOffRange", () => {
    it("splits a single component into three pieces when the range is in the middle", () => {
      const before = useProjectStore.getState().project;
      const welcome = before.layer.components[0]; // [0..7] "Welcome"
      // Split off "lc" at [3..5]
      const newId = useProjectStore.getState().splitOffRange(welcome.id, 3, 5);
      expect(newId).not.toBeNull();

      const after = useProjectStore.getState().project;
      // Should have one MORE component than before (1 original + 1 middle + 1 tail - 1 removed = +2)
      expect(after.layer.components).toHaveLength(before.layer.components.length + 2);

      // Find head, middle, tail by their ranges
      const head = after.layer.components.find((c) => c.endIndex === 3);
      const middle = after.layer.components.find((c) => c.id === newId);
      const tail = after.layer.components.find(
        (c) => c.startIndex === 5 && c.endIndex === 7,
      );
      expect(head).toBeDefined();
      expect(middle).toBeDefined();
      expect(tail).toBeDefined();

      expect(head!.startIndex).toBe(0);
      expect(middle!.startIndex).toBe(3);
      expect(middle!.endIndex).toBe(5);
      // Middle has no effects; head keeps the original's
      expect(middle!.effects).toHaveLength(0);
      expect(head!.effects.length).toBe(welcome.effects.length);
      // Tail has no effects
      expect(tail!.effects).toHaveLength(0);
    });

    it("does not produce an empty head when split starts at the original start", () => {
      const before = useProjectStore.getState().project;
      const welcome = before.layer.components[0];
      const id = useProjectStore.getState().splitOffRange(
        welcome.id,
        welcome.startIndex,
        welcome.endIndex - 1,
      );
      expect(id).not.toBeNull();
      const after = useProjectStore.getState().project;
      // No leftover empty-range component at [0..0]
      expect(
        after.layer.components.some(
          (c) => c.startIndex === c.endIndex,
        ),
      ).toBe(false);
    });

    it("returns null and is a no-op for an invalid range", () => {
      const before = useProjectStore.getState().project;
      const id = useProjectStore.getState().splitOffRange(
        before.layer.components[0].id,
        5,
        3,
      );
      expect(id).toBeNull();
      expect(useProjectStore.getState().project.layer.components).toEqual(
        before.layer.components,
      );
    });

    it("returns null when selection is outside the component", () => {
      const before = useProjectStore.getState().project;
      const id = useProjectStore.getState().splitOffRange(
        before.layer.components[0].id, // [0..7]
        10,
        12,
      );
      expect(id).toBeNull();
    });

    it("assigns the new middle component a different palette color", () => {
      const before = useProjectStore.getState().project;
      const welcome = before.layer.components[0];
      const id = useProjectStore.getState().splitOffRange(welcome.id, 3, 5);
      const after = useProjectStore.getState().project;
      const middle = after.layer.components.find((c) => c.id === id);
      expect(middle!.color).not.toBe(welcome.color);
    });
  });

  describe("mergeComponents", () => {
    it("merges two components into one spanning [first.start, last.end)", () => {
      const before = useProjectStore.getState().project;
      const [a, b] = before.layer.components; // [0..7] and [11..21]
      const id = useProjectStore.getState().mergeComponents([a.id, b.id]);
      expect(id).not.toBeNull();

      const after = useProjectStore.getState().project;
      expect(after.layer.components).toHaveLength(1);
      const merged = after.layer.components[0];
      expect(merged.id).toBe(id);
      expect(merged.startIndex).toBe(a.startIndex);
      expect(merged.endIndex).toBe(b.endIndex);
      // Inherits the first component's color/style
      expect(merged.color).toBe(a.color);
      expect(merged.style.color).toBe(a.style.color);
      // Concatenates effects from both
      expect(merged.effects).toHaveLength(a.effects.length + b.effects.length);
    });

    it("returns null with fewer than 2 valid components", () => {
      const before = useProjectStore.getState().project;
      expect(
        useProjectStore.getState().mergeComponents([before.layer.components[0].id]),
      ).toBeNull();
      expect(useProjectStore.getState().mergeComponents([])).toBeNull();
      expect(
        useProjectStore.getState().mergeComponents(["bogus-id-1", "bogus-id-2"]),
      ).toBeNull();
    });

    it("orders the components list by startIndex after a merge in the middle", () => {
      // Add a third component spanning [22..23] (one past the existing end of "reactimate.")
      // We need a longer text — use the sample text "Welcome to reactimate." (22 chars).
      // Add a component at the end: positions [21..22] which is "."
      const addedId = useProjectStore.getState().addComponent(21, 22);
      expect(addedId).not.toBeNull();

      const before = useProjectStore.getState().project;
      const [a, , c] = before.layer.components;
      // Merge the first and third (skipping the middle "reactimate" one)
      const mergedId = useProjectStore.getState().mergeComponents([a.id, c.id]);
      expect(mergedId).not.toBeNull();

      const after = useProjectStore.getState().project;
      // Should have 2 components now: merged (which spans 0..22) and the middle one (b at 11..21)
      // But wait — merging a [0..7] and c [21..22] gives a span [0..22], which OVERLAPS b [11..21].
      // The store doesn't enforce non-overlap on merge — caller's responsibility.
      // So we end up with overlapping components, but they're sorted by startIndex.
      const sorted = after.layer.components.map((x) => x.startIndex);
      const monotonic = sorted.every((v, i) => i === 0 || v >= sorted[i - 1]);
      expect(monotonic).toBe(true);
    });
  });
});
