import { describe, it, expect } from "vitest";
import { computeComponentStyle, computeTypewriterShape } from "../compose";
import type { Component, Effect, TypewriterShape } from "../../types/project";

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
          type: "zoom",
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

  it("repeat: N replays the effect (N+1 cycles total) within the same window", () => {
    // Fade from 0→1 over 1s, then repeat 1 more time (2 cycles total).
    // At t=0.5 first cycle is at midpoint → 0.5.
    // At t=1.5 second cycle is at midpoint → 0.5.
    // At t=2.0 second cycle completes → 1 (held).
    // At t=3 still past totalSpan, stays at 1.
    const c = baseComponent({
      effects: [{ ...fade(0, 1), repeat: 1 }],
    });
    expect(computeComponentStyle(c, 0.5).opacity).toBeCloseTo(0.5, 4);
    expect(computeComponentStyle(c, 1.5).opacity).toBeCloseTo(0.5, 4);
    expect(computeComponentStyle(c, 2.0).opacity).toBe(1);
  });

  it("repeat with repeatDelay holds at target during the gap between cycles", () => {
    // Fade 0→1 over 1s, then 0.5s delay, then replay.
    // At t=1 → first cycle ends, hold at 1.
    // At t=1.25 → in delay gap, still 1.
    // At t=1.5 → second cycle starts, back at 0 (snaps to from).
    // At t=2.0 → second cycle midpoint, 0.5.
    const c = baseComponent({
      effects: [{ ...fade(0, 1), repeat: 1, repeatDelay: 0.5 }],
    });
    expect(computeComponentStyle(c, 1.0).opacity).toBe(1);
    expect(computeComponentStyle(c, 1.25).opacity).toBe(1);
    expect(computeComponentStyle(c, 1.5).opacity).toBeCloseTo(0, 4);
    expect(computeComponentStyle(c, 2.0).opacity).toBeCloseTo(0.5, 4);
  });

  it("loopForever cycles continuously WITHIN the effect window only", () => {
    // Fade 0→1 over 1s, loopForever. The window IS the effect's bar
    // [0, 1]; even with loop forever, visibility ends when the bar
    // ends — past it the standard gap-hide rule kicks in (opacity=0).
    //
    // (loopForever's only visible effect today is to make the cycling
    // math active inside the window — for visible REPEATS, the user
    // sets `repeat` so cycles play back-to-back inside an extended
    // window. The boolean exists primarily to survive JSON round-trip
    // — the previous Infinity-on-repeat representation collapsed to
    // null on reload.)
    const c = baseComponent({
      effects: [{ ...fade(0, 1), loopForever: true }],
    });
    expect(computeComponentStyle(c, 0.25).opacity).toBeCloseTo(0.25, 4);
    expect(computeComponentStyle(c, 0.75).opacity).toBeCloseTo(0.75, 4);
    expect(computeComponentStyle(c, 10).opacity).toBe(0);
  });

  it("does not mutate the input component or its effects", () => {
    const eff = fade(1, 1);
    const c = baseComponent({ effects: [eff] });
    const snapshot = JSON.parse(JSON.stringify(c));
    computeComponentStyle(c, 1.5);
    expect(c).toEqual(snapshot);
  });
});

describe("computeTypewriterShape", () => {
  const baseShape: TypewriterShape = {
    type: "square",
    layer: "behind",
    color: "#fbbf24",
    sizeFrom: 0,
    sizeTo: 80,
    blurFrom: 8,
    blurTo: 0,
    fadeFrom: 1,
    fadeTo: 1,
  };
  const tw = (
    startTime: number,
    duration: number,
    shape: TypewriterShape | undefined = baseShape,
    overrides: Partial<Effect> = {},
  ): Effect => ({
    id: "tw1",
    type: "typewriter",
    startTime,
    duration,
    easing: "linear",
    targets: { opacity: 1 },
    typewriter: { mode: "snap", shape },
    ...overrides,
  });

  it("returns null when not a typewriter or no shape config", () => {
    const fadeEff: Effect = { ...tw(0, 1), type: "fade", typewriter: undefined };
    expect(computeTypewriterShape(fadeEff, 5, 0, 0)).toBeNull();
    const noShape: Effect = { ...tw(0, 1), typewriter: { mode: "snap" } };
    expect(computeTypewriterShape(noShape, 5, 0, 0)).toBeNull();
  });

  it("returns start values + visible:false before the letter's window", () => {
    // duration 1s, 5 letters → perLetter 0.2s; letter 2 starts at 0.4s.
    const r = computeTypewriterShape(tw(0, 1), 5, 2, 0.1);
    expect(r).not.toBeNull();
    expect(r!.size).toBe(0);
    expect(r!.blur).toBe(8);
    expect(r!.opacity).toBe(1);
    expect(r!.visible).toBe(false);
  });

  it("lerps mid-window with linear easing", () => {
    // letter 0 window [0, 0.2]. At t=0.1 → halfway.
    const r = computeTypewriterShape(tw(0, 1), 5, 0, 0.1);
    expect(r).not.toBeNull();
    expect(r!.size).toBeCloseTo(40, 5);   // 0 → 80, halfway = 40
    expect(r!.blur).toBeCloseTo(4, 5);    // 8 → 0, halfway = 4
    expect(r!.opacity).toBeCloseTo(1, 5); // 1 → 1, halfway = 1
    expect(r!.visible).toBe(true);
  });

  it("holds at end values after the letter's window completes", () => {
    // letter 0 window [0, 0.2]. At t=0.5 → past end → end values.
    const r = computeTypewriterShape(tw(0, 1), 5, 0, 0.5);
    expect(r).not.toBeNull();
    expect(r!.size).toBe(80);
    expect(r!.blur).toBe(0);
    expect(r!.opacity).toBe(1);
    expect(r!.visible).toBe(true);
  });

  it("honors staggerDirection: reverse — last letter animates first", () => {
    // 5 letters, reverse → letter 0 actually animates LAST (window [0.8, 1.0]).
    const eff = tw(0, 1, baseShape, { staggerDirection: "reverse" });
    // At t=0.05, letter 0 hasn't started yet (its window starts at 0.8).
    const before = computeTypewriterShape(eff, 5, 0, 0.05);
    expect(before!.visible).toBe(false);
    // At t=0.05, letter 4 IS animating (idx flipped to 0, window [0, 0.2]).
    const last = computeTypewriterShape(eff, 5, 4, 0.05);
    expect(last!.visible).toBe(true);
    expect(last!.size).toBeCloseTo(20, 5); // quarter of the way
  });

  it("respects effect.startTime offset", () => {
    // effect starts at t=2. letter 0 window [2.0, 2.2].
    const eff = tw(2, 1);
    expect(computeTypewriterShape(eff, 5, 0, 1.9)!.visible).toBe(false);
    expect(computeTypewriterShape(eff, 5, 0, 2.1)!.size).toBeCloseTo(40, 5);
    expect(computeTypewriterShape(eff, 5, 0, 2.5)!.size).toBe(80);
  });
});
