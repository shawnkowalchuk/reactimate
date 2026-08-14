import { describe, expect, it } from "vitest";
import { summarizeProject } from "../summarizeProject";
import { makeSampleProject } from "../../../sample/sampleProject";
import type { Effect, Project } from "../../../types/project";

const effect = (over: Partial<Effect>): Effect => ({
  id: `e_${Math.random().toString(36).slice(2)}`,
  type: "fade",
  startTime: 0,
  duration: 0.5,
  easing: "ease-out",
  targets: { opacity: 1 },
  ...over,
});

describe("summarizeProject", () => {
  it("flags the untouched sample project", () => {
    const s = summarizeProject(makeSampleProject());
    expect(s.looksUntouched).toBe(true);
  });

  it("does not flag a project whose text was edited", () => {
    const p = makeSampleProject();
    p.layer.text = "Something the user actually typed";
    expect(summarizeProject(p).looksUntouched).toBe(false);
  });

  it("does not flag a project with a different component count", () => {
    const p = makeSampleProject();
    p.layer.components = p.layer.components.slice(0, 1);
    expect(summarizeProject(p).looksUntouched).toBe(false);
  });

  it("excludes `custom` placeholders from the effect count", () => {
    const p = makeSampleProject();
    p.layer.components = [
      {
        id: "c1",
        startIndex: 0,
        endIndex: 5,
        color: "#fff",
        style: p.layer.components[0].style,
        effects: [
          effect({ type: "custom" }),
          effect({ type: "fade" }),
          effect({ type: "particle" }),
        ],
      },
    ];
    const s = summarizeProject(p);
    expect(s.effectCount).toBe(2);
    expect(s.effectTypes).toEqual(["fade", "particle"]);
  });

  it("dedupes effect types while preserving first-seen order", () => {
    const p = makeSampleProject();
    p.layer.components = [
      {
        id: "c1",
        startIndex: 0,
        endIndex: 5,
        color: "#fff",
        style: p.layer.components[0].style,
        effects: [
          effect({ type: "slide" }),
          effect({ type: "fade" }),
          effect({ type: "slide" }),
        ],
      },
    ];
    expect(summarizeProject(p).effectTypes).toEqual(["slide", "fade"]);
  });

  it("collapses whitespace in the displayed text", () => {
    const p = makeSampleProject();
    p.layer.text = "Line one\n\n  Line   two  ";
    const s = summarizeProject(p);
    expect(s.text).toBe("Line one Line two");
    // textLength reports the real stored length, not the collapsed one.
    expect(s.textLength).toBe(p.layer.text.length);
  });

  it("survives a malformed project without throwing", () => {
    const broken = { name: "x", duration: 3 } as unknown as Project;
    const s = summarizeProject(broken);
    expect(s.componentCount).toBe(0);
    expect(s.effectCount).toBe(0);
    expect(s.canvas).toBe("—");
  });
});
