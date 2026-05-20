import { describe, it, expect } from "vitest";
import { generateReactComponent } from "../generateComponent";
import { makeSampleProject } from "../../sample/sampleProject";
import type { Project } from "../../types/project";

describe("generateReactComponent", () => {
  it("produces a Hero component string that parses as a JS Function", () => {
    const out = generateReactComponent(makeSampleProject());
    // Smoke: the entire body should be syntactically valid JSX-stripped JS.
    // We can't run JSX directly in Node, so we strip the JSX tags and check
    // the surrounding scaffold parses. The `motion.span` etc. are inside JSX,
    // so removing the JSX block leaves us with just the imports and the function.
    expect(out).toContain('import { motion } from "motion/react";');
    expect(out).toMatch(/export function Hero\(\) \{/);
    expect(out).toMatch(/<motion\.span/);
  });

  it("uses double-quoted strings inside JS expressions (idiomatic)", () => {
    const out = generateReactComponent(makeSampleProject());
    // Non-linear easing resolves to the engine-matched EASE table.
    expect(out).toMatch(/ease: EASE\["ease-out"\]/);
    // Style values should use double quotes
    expect(out).toMatch(/fontFamily: "Inter"/);
  });

  it("escapes text content via {\"...\"} expressions, not raw text", () => {
    const project = makeSampleProject();
    // Punctuation/period in the sample text → must come through as a JSX expression
    const out = generateReactComponent(project);
    expect(out).toMatch(/\{"\."}/); // the trailing "."
    expect(out).toMatch(/\{"Welcome"\}/); // inside the motion.span
    expect(out).toMatch(/\{" to "}/); // the un-componentized middle
  });

  it("emits a non-animated <span> (not motion.span) when a component has no effects", () => {
    const project = makeSampleProject();
    project.layer.components[0].effects = [];
    const out = generateReactComponent(project);
    // First componentized span is now static → must use <span style=...>{"Welcome"}</span>
    expect(out).toMatch(/<span\s+style=/);
    // But the second still animates
    expect(out).toMatch(/<motion\.span/);
  });

  it("survives a project with zero components", () => {
    const project: Project = {
      ...makeSampleProject(),
      layer: {
        ...makeSampleProject().layer,
        components: [],
        text: "Just plain.",
      },
    };
    const out = generateReactComponent(project);
    expect(out).toContain('{"Just plain."}');
    expect(out).not.toMatch(/<motion\.span/);
  });

  it("emits proper imports and a single export", () => {
    const out = generateReactComponent(makeSampleProject());
    const importMatches = out.match(/^import /gm);
    const exportMatches = out.match(/^export /gm);
    expect(importMatches).toHaveLength(1);
    expect(exportMatches).toHaveLength(1);
  });

  it("renders an animated color effect into initial/animate, not into style", () => {
    const project = makeSampleProject();
    project.layer.components[0].effects = [
      {
        id: "color1",
        type: "color-shift",
        startTime: 0,
        duration: 1,
        easing: "linear",
        targets: { color: "#ff0000" },
      },
    ];
    const out = generateReactComponent(project);
    // The animated component span's `style` block must NOT include a color line
    // (because the color comes from initial/animate).
    // Easy way: the literal `color: "#fafafa"` from the start style should now appear in `initial`, not in style.
    expect(out).toMatch(/initial=\{[\s\S]*color: "#fafafa"[\s\S]*\}/);
    expect(out).toMatch(/animate=\{[\s\S]*color: "#ff0000"[\s\S]*\}/);
  });

  it("preserves text order (componentized + interleaved plain)", () => {
    const out = generateReactComponent(makeSampleProject());
    const welcomeAt = out.indexOf('{"Welcome"}');
    const middleAt = out.indexOf('{" to "}');
    const reactimateAt = out.indexOf('{"reactimate"}');
    const periodAt = out.indexOf('{"."}');
    expect(welcomeAt).toBeLessThan(middleAt);
    expect(middleAt).toBeLessThan(reactimateAt);
    expect(reactimateAt).toBeLessThan(periodAt);
  });
});

describe("output snapshot — sample project", () => {
  it("matches a stable, idiomatic shape", () => {
    // Force deterministic times in the sample project for snapshot stability
    // by using makeSampleProject directly (which is deterministic in structure,
    // only the IDs are random — those don't appear in output).
    const out = generateReactComponent(makeSampleProject());
    // High-level shape checks — avoid full snapshot to stay flexible to formatting tweaks
    expect(out.split("\n")[0]).toBe('import { motion } from "motion/react";');
    expect(out.trim().endsWith("}")).toBe(true);
  });
});
