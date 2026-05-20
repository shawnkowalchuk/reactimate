import { describe, it, expect } from "vitest";
import { buildFireworksExport } from "../fireworksToMotion";
import type { Component, Effect } from "../../types/project";

const fireworksEffect = (
  fireworks: Partial<NonNullable<Effect["fireworks"]>> = {},
): Effect => ({
  id: "fx",
  type: "fireworks-js",
  startTime: 0,
  duration: 2,
  easing: "linear",
  targets: {},
  fireworks: {
    density: 50,
    explosion: 5,
    area: { x: 200, y: 120, width: 800, height: 300 },
    ...fireworks,
  },
});

const component = (effects: Effect[]): Component => ({
  id: "c1",
  startIndex: 0,
  endIndex: 5,
  color: "#fff",
  style: {
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: 600,
    color: "#000000",
    letterSpacing: 0,
    alignment: "center",
    x: 0,
    y: 0,
    opacity: 1,
    scale: 1,
    rotation: 0,
    blur: 0,
  },
  effects,
});

describe("buildFireworksExport", () => {
  it("returns null when no component has a fireworks effect", () => {
    expect(buildFireworksExport([component([])], 1200, 675)).toBeNull();
  });

  it("emits autoFire / onlyInArea / area into the layer config", () => {
    const result = buildFireworksExport(
      [
        component([
          fireworksEffect({
            followMouse: true,
            autoFire: false,
            onlyInArea: true,
          }),
        ]),
      ],
      1200,
      675,
    );
    expect(result).not.toBeNull();
    const jsx = result!.layerJsx[0];
    expect(jsx).toContain('"autoFire":false');
    expect(jsx).toContain('"onlyInArea":true');
    expect(jsx).toContain('"area":{"x":200,"y":120,"width":800,"height":300}');
    // boundaries solve fireworks-js's targeting formula for the area.
    expect(jsx).toContain('"boundaries":{"x":200,"y":120,"width":1400,"height":840}');
  });

  it("generates a helper that drives clicks itself, not via the library", () => {
    const result = buildFireworksExport(
      [component([fireworksEffect({ followMouse: true })])],
      1200,
      675,
    );
    const helper = result!.helperComponent;
    // Library mouse handling is off — its launch() schedules a stop.
    expect(helper).toContain("mouse: { click: false, move: false");
    // Clicks fire a rocket directly.
    expect(helper).toContain("fw.createTrace()");
    // Auto-fire off pins the delay to infinity.
    expect(helper).toContain("{ min: 999999, max: 999999 }");
    // The canvas itself never captures pointer events.
    expect(helper).toContain('pointerEvents: "none"');
  });
});
