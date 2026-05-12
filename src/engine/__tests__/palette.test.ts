import { describe, it, expect } from "vitest";
import { PALETTE, nextColor } from "../palette";

describe("nextColor", () => {
  it("returns the first palette color when none are used", () => {
    expect(nextColor([])).toBe(PALETTE[0]);
  });

  it("returns the first unused palette color", () => {
    expect(nextColor([PALETTE[0], PALETTE[1]])).toBe(PALETTE[2]);
  });

  it("cycles back to the start when all colors are used", () => {
    expect(nextColor([...PALETTE])).toBe(PALETTE[PALETTE.length % PALETTE.length]);
  });
});
