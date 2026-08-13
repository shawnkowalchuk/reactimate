import { describe, it, expect } from "vitest";
import { formatDuration } from "../formatDuration";

describe("formatDuration", () => {
  it("reports sub-minute values in seconds so new accounts don't read as 0", () => {
    expect(formatDuration(1)).toBe("1s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("switches to whole minutes at a minute", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(90)).toBe("1m");
    expect(formatDuration(59 * 60)).toBe("59m");
  });

  it("shows hours with remainder minutes, dropping a zero remainder", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3600 + 12 * 60)).toBe("1h 12m");
    expect(formatDuration(2 * 3600)).toBe("2h");
  });

  it("shows days with remainder hours past 24h", () => {
    expect(formatDuration(24 * 3600)).toBe("1d");
    expect(formatDuration(25 * 3600)).toBe("1d 1h");
    expect(formatDuration(50 * 3600)).toBe("2d 2h");
  });

  it("treats zero, negative, and non-finite input as 0s", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(-5)).toBe("0s");
    expect(formatDuration(Number.NaN)).toBe("0s");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("0s");
  });
});
