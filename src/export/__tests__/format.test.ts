import { describe, it, expect } from "vitest";
import { fmt, jsxTextExpression } from "../format";

describe("fmt", () => {
  it("formats primitives", () => {
    expect(fmt(42)).toBe("42");
    expect(fmt(3.14)).toBe("3.14");
    expect(fmt(true)).toBe("true");
    expect(fmt(null)).toBe("null");
    expect(fmt("hi")).toBe('"hi"');
  });

  it("rounds floats to 6 decimal places to avoid noise like 0.30000000000000004", () => {
    expect(fmt(0.1 + 0.2)).toBe("0.3");
  });

  it("inlines short objects with valid-identifier keys (no quoted keys)", () => {
    expect(fmt({ x: 1, y: 2 })).toBe("{ x: 1, y: 2 }");
  });

  it("quotes keys that aren't valid identifiers", () => {
    expect(fmt({ "font-size": 12 })).toBe('{ "font-size": 12 }');
  });

  it("expands long objects across multiple lines", () => {
    const out = fmt({
      fontFamily: "Inter Variable Display Pro",
      fontSize: 96,
      fontWeight: 800,
      color: "#fafafa",
      letterSpacing: 0,
    });
    expect(out).toContain("\n");
    expect(out.split("\n").length).toBeGreaterThan(3);
  });

  it("inlines short arrays", () => {
    expect(fmt([0, 0.5, 1])).toBe("[0, 0.5, 1]");
  });

  it("formats empty containers compactly", () => {
    expect(fmt({})).toBe("{}");
    expect(fmt([])).toBe("[]");
  });

  it("respects nested indentation depth", () => {
    const out = fmt(
      {
        outer: {
          inner: { a: "long string value here, definitely past inline limit" },
        },
      },
      0,
    );
    // Inner lines should be indented further than outer ones
    const lines = out.split("\n");
    const outerIndent = lines.find((l) => l.includes("outer:"))?.match(/^\s*/)?.[0]
      .length;
    const innerIndent = lines.find((l) => l.includes("inner:"))?.match(/^\s*/)?.[0]
      .length;
    expect(innerIndent).toBeGreaterThan(outerIndent ?? 0);
  });
});

describe("jsxTextExpression", () => {
  it("wraps text in a JSX expression with a JS string literal", () => {
    expect(jsxTextExpression("hello")).toBe('{"hello"}');
  });
  it("escapes embedded quotes and special chars", () => {
    expect(jsxTextExpression('he said "hi"')).toBe('{"he said \\"hi\\""}');
    expect(jsxTextExpression("a\nb")).toBe('{"a\\nb"}');
  });
});
