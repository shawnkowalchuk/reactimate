import { describe, it, expect } from "vitest";
import { computeComponentStyle } from "../compose";
import type { Component, Effect } from "../../types/project";

const baseComponent = (overrides: Partial<Component> = {}): Component => ({
  id: "c1",
  startIndex: 0,
  endIndex: 5,
  color: "hsl(210, 80%, 60%)",
  style: {
    fontFamily: "system-ui",
    fontSize: 48,
    fontWeight: 600,
    color: "#ff0000",
    letterSpacing: 0,
    alignment: "left" as const,
    x: 0,
    y: 0,
    opacity: 0,
    scale: 1,
    rotation: 0,
    blur: 0,
  },
  effects: [],
  ...overrides,
});

const fade = (startTime: number, duration: number): Effect => ({
  id: `e_${startTime}`,
  type: "fade",
  startTime,
  duration,
  easing: "linear",
  targets: { opacity: 1 },
});

describe("computeComponentStyle", () => {
  it("returns the start style when there are no effects", () => {
    const c = baseComponent();
    expect(computeComponentStyle(c, 0).opacity).toBe(0);
    expect(computeComponentStyle(c, 5).opacity).toBe(0);
  });

  it("returns the start value before an effect begins", () => {
    const c = baseComponent({ effects: [fade(1, 1)] });
    expect(computeComponentStyle(c, 0).opacity).toBe(0);
    expect(computeComponentStyle(c, 0.5).opacity).toBe(0);
  });

  it("returns the target value AT the effect end, then gap-hides", () => {
    // Updated: after an effect ends, the component is forced to opacity=0
    // (gap-hide rule). At the boundary (time === endTime) the effect is
    // still considered active, so opacity = target.
    const c = baseComponent({ effects: [fade(1, 1)] });
    expect(computeComponentStyle(c, 2).opacity).toBe(1);
    expect(computeComponentStyle(c, 5).opacity).toBe(0);
  });

  it("linearly interpolates during the effect", () => {
    const c = baseComponent({ effects: [fade(1, 2)] });
    // 1.5s is 25% of the way through a 2s effect starting at 1s
    expect(computeComponentStyle(c, 1.5).opacity).toBeCloseTo(0.25);
    expect(computeComponentStyle(c, 2).opacity).toBeCloseTo(0.5);
    expect(computeComponentStyle(c, 2.5).opacity).toBeCloseTo(0.75);
  });

  it("treats multiple effects on the same property as 'last completed wins' inside ranges; gap-hides between", () => {
    const c = baseComponent({
      style: { ...baseComponent().style, opacity: 0 },
      effects: [
        // 0..1: 0 -> 1
        { ...fade(0, 1), targets: { opacity: 1 } },
        // 2..3: 1 -> 0.3 (from = 1, the completed value)
        { ...fade(2, 1), id: "e2", targets: { opacity: 0.3 } },
      ],
    });
    expect(computeComponentStyle(c, 1).opacity).toBe(1); // boundary of effect 1
    expect(computeComponentStyle(c, 1.5).opacity).toBe(0); // gap → hidden
    expect(computeComponentStyle(c, 2.5).opacity).toBeCloseTo(0.65);
    expect(computeComponentStyle(c, 3).opacity).toBeCloseTo(0.3);
  });

  it("independent effects on different properties run independently", () => {
    const c = baseComponent({
      style: { ...baseComponent().style, opacity: 0, scale: 1 },
      effects: [
        { ...fade(0, 1), targets: { opacity: 1 } },
        {
          id: "e_scale",
          type: "scale",
          startTime: 1,
          duration: 1,
          easing: "linear",
          targets: { scale: 2 },
        },
      ],
    });
    const s = computeComponentStyle(c, 1.5);
    expect(s.opacity).toBe(1);
    expect(s.scale).toBeCloseTo(1.5);
  });

  it("a zero-duration effect snaps to its target immediately", () => {
    const c = baseComponent({
      effects: [{ ...fade(1, 0), targets: { opacity: 1 } }],
    });
    expect(computeComponentStyle(c, 0.99).opacity).toBe(0);
    expect(computeComponentStyle(c, 1).opacity).toBe(1);
  });

  it("interpolates colors as well as numbers", () => {
    const c = baseComponent({
      style: { ...baseComponent().style, color: "#000000" },
      effects: [
        {
          id: "e_color",
          type: "color-shift",
          startTime: 0,
          duration: 1,
          easing: "linear",
          targets: { color: "#ffffff" },
        },
      ],
    });
    expect(computeComponentStyle(c, 0.5).color).toBe("rgb(128, 128, 128)");
  });

  it("does not mutate the input component or its effects", () => {
    const eff = fade(1, 1);
    const c = baseComponent({ effects: [eff] });
    const snapshot = JSON.parse(JSON.stringify(c));
    computeComponentStyle(c, 1.5);
    expect(c).toEqual(snapshot);
  });
});
