import { describe, it, expect } from "vitest";
import {
  buildComponentMotion,
  buildPropTransition,
} from "../effectToMotion";
import type { Component, Effect } from "../../types/project";

const c = (overrides: Partial<Component> = {}): Component => ({
  id: "c1",
  startIndex: 0,
  endIndex: 5,
  color: "hsl(210, 80%, 60%)",
  style: {
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: 600,
    color: "#000000",
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

const fade = (
  start: number,
  duration: number,
  target = 1,
  easing: Effect["easing"] = "ease-out",
): Effect => ({
  id: `e_${start}`,
  type: "fade",
  startTime: start,
  duration,
  easing,
  targets: { opacity: target },
});

describe("buildPropTransition", () => {
  it("returns null when no effects touch the property", () => {
    expect(buildPropTransition(c(), "opacity", 3)).toBeNull();
  });

  it("emits the single-effect form for one effect", () => {
    const result = buildPropTransition(
      c({ effects: [fade(0.1, 0.6, 1, "ease-out")] }),
      "opacity",
      3,
    );
    expect(result).toEqual({
      motionProp: "opacity",
      initial: 0,
      animate: 1,
      transition: { delay: 0.1, duration: 0.6, ease: "easeOut" },
    });
  });

  it("emits a keyframe array when multiple effects touch the property", () => {
    // Two effects on opacity:
    //   0..1: fade from 0 → 1 (ease-out)
    //   2..3: fade from 1 → 0.3 (ease-in)
    // Expected keyframes at t=[0, 1, 2, 3]: [0, 1, 1, 0.3]
    // Eases for the three segments: [easeOut (effect 1), linear (hold), easeIn (effect 2)]
    const result = buildPropTransition(
      c({
        effects: [
          fade(0, 1, 1, "ease-out"),
          { ...fade(2, 1, 0.3, "ease-in"), id: "e2" },
        ],
      }),
      "opacity",
      3,
    );
    expect(result?.animate).toEqual([0, 1, 1, 0.3]);
    const t = (result?.transition as { times: number[] }).times;
    expect(t).toEqual([0, 1 / 3, 2 / 3, 1].map((x) => +x.toFixed(6)));
    expect((result?.transition as { ease: string[] }).ease).toEqual([
      "easeOut",
      "linear",
      "easeIn",
    ]);
  });

  it("uses the rotation→rotate motion prop name", () => {
    const result = buildPropTransition(
      c({
        effects: [
          {
            id: "r",
            type: "rotate",
            startTime: 0,
            duration: 1,
            easing: "linear",
            targets: { rotation: 180 },
          },
        ],
      }),
      "rotation",
      2,
    );
    expect(result?.motionProp).toBe("rotate");
  });
});

describe("buildComponentMotion", () => {
  it("returns isStatic=true when there are no effects", () => {
    const result = buildComponentMotion(c(), 3);
    expect(result.isStatic).toBe(true);
    expect(result.initial).toEqual({});
    expect(result.animate).toEqual({});
  });

  it("consolidates per-property transitions when they are identical", () => {
    // Three props animated by one shared effect → one shared transition
    const result = buildComponentMotion(
      c({
        effects: [
          {
            id: "e",
            type: "slide",
            startTime: 0.7,
            duration: 0.6,
            easing: "ease-out",
            targets: { opacity: 1, y: 0, scale: 1 },
          },
        ],
      }),
      3,
    );
    expect(result.transition).toEqual({
      delay: 0.7,
      duration: 0.6,
      ease: "easeOut",
    });
    expect(result.initial).toMatchObject({ opacity: 0, y: 0, scale: 1 });
    expect(result.animate).toMatchObject({ opacity: 1, y: 0, scale: 1 });
  });

  it("uses per-property transitions when timings differ", () => {
    const result = buildComponentMotion(
      c({
        effects: [
          fade(0.1, 0.6, 1, "ease-out"),
          {
            id: "scale",
            type: "scale",
            startTime: 1,
            duration: 0.4,
            easing: "spring",
            targets: { scale: 1.2 },
          },
        ],
      }),
      3,
    );
    // Per-property keys (not a flat duration/delay/ease at the top)
    expect(result.transition).toHaveProperty("opacity");
    expect(result.transition).toHaveProperty("scale");
    expect((result.transition as Record<string, unknown>).opacity).toEqual({
      delay: 0.1,
      duration: 0.6,
      ease: "easeOut",
    });
  });
});
