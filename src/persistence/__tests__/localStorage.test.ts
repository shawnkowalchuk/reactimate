import { describe, it, expect, beforeEach } from "vitest";
import {
  clearStorage,
  loadFromStorage,
  saveToStorage,
  validateProject,
} from "../localStorage";
import { makeSampleProject } from "../../sample/sampleProject";

describe("validateProject", () => {
  it("accepts a well-formed project", () => {
    const p = makeSampleProject();
    expect(validateProject(p)).toBe(p);
  });

  it("rejects non-object input", () => {
    expect(validateProject(null)).toBeNull();
    expect(validateProject(undefined)).toBeNull();
    expect(validateProject("not a project")).toBeNull();
    expect(validateProject(42)).toBeNull();
  });

  it("rejects projects missing required top-level fields", () => {
    const p = makeSampleProject() as unknown as Record<string, unknown>;
    delete p.duration;
    expect(validateProject(p)).toBeNull();
  });

  it("rejects projects with components missing required fields", () => {
    const p = makeSampleProject();
    // @ts-expect-error — intentionally corrupt
    delete p.layer.components[0].style;
    expect(validateProject(p)).toBeNull();
  });

  it("rejects projects where duration is not a finite number", () => {
    const p = makeSampleProject();
    (p as { duration: number }).duration = Number.POSITIVE_INFINITY;
    expect(validateProject(p)).toBeNull();
  });

  it("migrates old particle mode 'around'+rangePx to 'area'+area rectangle", () => {
    const p = makeSampleProject() as unknown as { layer: { components: unknown[] } };
    const c = (p.layer.components as Array<{ effects: Array<Record<string, unknown>> }>)[0];
    c.effects.push({
      id: "fx_old",
      type: "particle",
      startTime: 0,
      duration: 1,
      easing: "linear",
      targets: {},
      particle: { density: 10, size: 12, color: "#fff", preset: "gold", mode: "around", rangePx: 40 },
    });
    const v = validateProject(p);
    expect(v).not.toBeNull();
    const migrated = (v as unknown as { layer: { components: Array<{ effects: Array<Record<string, unknown>> }> } })
      .layer.components[0].effects.find((e) => (e as { id: string }).id === "fx_old");
    const part = (migrated as { particle: { mode: string; area: object; rangePx?: number } }).particle;
    expect(part.mode).toBe("area");
    expect(part.area).toBeDefined();
    expect(part.rangePx).toBeUndefined();
  });

  it("migrates old fireworks mode/spreadRadius to 'area' rectangle", () => {
    const p = makeSampleProject() as unknown as { layer: { components: unknown[] } };
    const c = (p.layer.components as Array<{ effects: Array<Record<string, unknown>> }>)[0];
    c.effects.push({
      id: "fx_fw_old",
      type: "fireworks-js",
      startTime: 0,
      duration: 1,
      easing: "linear",
      targets: {},
      fireworks: { density: 50, explosion: 5, mode: "around", spreadRadius: 200 },
    });
    const v = validateProject(p);
    const migrated = (v as unknown as { layer: { components: Array<{ effects: Array<Record<string, unknown>> }> } })
      .layer.components[0].effects.find((e) => (e as { id: string }).id === "fx_fw_old");
    const fw = (migrated as { fireworks: { area: object; mode?: string; spreadRadius?: number } }).fireworks;
    expect(fw.area).toBeDefined();
    expect(fw.mode).toBeUndefined();
    expect(fw.spreadRadius).toBeUndefined();
  });
});

describe("localStorage round-trip", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing is saved", () => {
    expect(loadFromStorage()).toBeNull();
  });

  it("returns the saved project after a save", () => {
    const p = makeSampleProject();
    saveToStorage(p);
    const loaded = loadFromStorage();
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(p.id);
    expect(loaded?.layer.components).toHaveLength(p.layer.components.length);
  });

  it("clearStorage removes the saved project", () => {
    saveToStorage(makeSampleProject());
    clearStorage();
    expect(loadFromStorage()).toBeNull();
  });

  it("returns null when the stored blob is corrupt JSON", () => {
    window.localStorage.setItem("reactimate.project.v1", "{not json");
    expect(loadFromStorage()).toBeNull();
  });

  it("returns null when the schema version doesn't match", () => {
    const blob = JSON.stringify({
      schemaVersion: 99,
      savedAt: new Date().toISOString(),
      project: makeSampleProject(),
    });
    window.localStorage.setItem("reactimate.project.v1", blob);
    expect(loadFromStorage()).toBeNull();
  });

  it("returns null when the project payload fails validation", () => {
    const blob = JSON.stringify({
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      project: { id: "x" }, // missing required fields
    });
    window.localStorage.setItem("reactimate.project.v1", blob);
    expect(loadFromStorage()).toBeNull();
  });
});
