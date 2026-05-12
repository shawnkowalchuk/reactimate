import { describe, it, expect } from "vitest";
import { lerp, lerpColor, lerpProperty } from "../interpolate";

describe("lerp", () => {
  it("returns the from value at t=0", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });
  it("returns the to value at t=1", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });
  it("returns the midpoint at t=0.5", () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
  it("extrapolates outside 0..1 (no internal clamping)", () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
  });
});

describe("lerpColor", () => {
  it("returns the from color at t=0", () => {
    expect(lerpColor("#000000", "#ffffff", 0)).toBe("rgb(0, 0, 0)");
  });
  it("returns the to color at t=1", () => {
    expect(lerpColor("#000000", "#ffffff", 1)).toBe("rgb(255, 255, 255)");
  });
  it("interpolates rgb channels at the midpoint", () => {
    expect(lerpColor("#000000", "#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
  });
  it("accepts hsl() input", () => {
    // hsl(0, 100%, 50%) === rgb(255, 0, 0)
    expect(lerpColor("hsl(0, 100%, 50%)", "#000000", 0)).toBe("rgb(255, 0, 0)");
  });
  it("accepts rgb() input", () => {
    expect(lerpColor("rgb(10, 20, 30)", "rgb(20, 40, 60)", 0.5)).toBe(
      "rgb(15, 30, 45)",
    );
  });
});

describe("lerpProperty", () => {
  it("routes color props through lerpColor", () => {
    expect(lerpProperty("color", "#000000", "#ffffff", 0.5)).toBe(
      "rgb(128, 128, 128)",
    );
  });
  it("routes numeric props through lerp", () => {
    expect(lerpProperty("opacity", 0, 1, 0.25)).toBe(0.25);
    expect(lerpProperty("x", -10, 10, 0.5)).toBe(0);
  });
});
