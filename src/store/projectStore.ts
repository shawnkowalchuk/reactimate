import { create } from "zustand";
import { temporal } from "zundo";
import type {
  AnimatableTargets,
  CanvasPreset,
  Component,
  ComponentStyle,
  Effect,
  EffectArea,
  Project,
} from "../types/project";
import { adjustRanges } from "../engine/ranges";
import { nextColor } from "../engine/palette";
import { EFFECT_DEFAULTS } from "../constants/effects";
import { CANVAS_PRESETS } from "../constants/presets";
import { newId } from "../utils/id";
import { makeSampleProject } from "../sample/sampleProject";
import { loadFromStorage } from "../persistence/localStorage";

function initialProject(): Project {
  return loadFromStorage() ?? makeSampleProject();
}

/**
 * The "(no effect)" placeholder every newly-created component starts with.
 *
 * A component is only visible while one of its effects' [start, end]
 * windows is active — outside every window `compose.ts` forces opacity to
 * 0, and a component with an EMPTY effects array is never active at all.
 * So without this, componentizing a word made it vanish, which is the
 * most confusing thing a new user can hit: they did what the editor told
 * them to do and the text disappeared.
 *
 * Starting every component with a `custom` block spanning the whole
 * project makes it visible from the first frame and gives it a timeline
 * row to swap for a real effect. Same thing `makeWordComponents` does for
 * the homepage examples (see CLAUDE.md).
 */
function placeholderEffect(projectDuration: number): Effect {
  return {
    id: newId("fx"),
    type: "custom",
    startTime: 0,
    duration: projectDuration,
    easing: "linear",
    targets: {},
  };
}

/**
 * Default rectangle for a freshly-added particle/fireworks effect — a
 * sensibly-sized box centered on the project canvas.
 */
function defaultEffectArea(
  canvas: { width: number; height: number },
  padding = 0,
): EffectArea {
  const w = Math.min(canvas.width - 80, 480 + padding * 2);
  const h = Math.min(canvas.height - 80, 240 + padding * 2);
  return {
    x: Math.round((canvas.width - w) / 2),
    y: Math.round((canvas.height - h) / 2),
    width: w,
    height: h,
  };
}

export interface ProjectState {
  project: Project;

  setProject: (p: Project) => void;
  resetToSample: () => void;

  // Layer / text
  updateLayerText: (
    newText: string,
    editStart: number,
    editEnd: number,
    newLength: number,
  ) => void;
  setAlignment: (alignment: Project["layer"]["alignment"]) => void;

  // Components
  addComponent: (
    startIndex: number,
    endIndex: number,
    style?: Partial<ComponentStyle>,
  ) => string | null;
  removeComponent: (componentId: string) => void;
  /**
   * Append a copy of the component's text to the end of the layer text
   * (separated by a space) and create a new component over that range
   * with the same style and a fresh copy of the effects (new ids).
   * Returns the new component id, or null if the source wasn't found.
   */
  duplicateComponent: (componentId: string) => string | null;
  updateComponentStyle: (
    componentId: string,
    patch: Partial<ComponentStyle>,
  ) => void;
  /**
   * Split a sub-range `[selStart, selEnd)` out of an existing component.
   * The host component is sliced into up to three pieces:
   *   [start, selStart)         — head, keeps the original style + effects
   *   [selStart, selEnd)        — extracted middle, NEW component (no effects)
   *   [selEnd, end)              — tail, keeps the original style (no effects)
   * Empty pieces are dropped. Returns the new middle component's id, or
   * null if the input was rejected (no such component, selection out of
   * bounds, or selStart >= selEnd).
   */
  splitOffRange: (
    componentId: string,
    selStart: number,
    selEnd: number,
  ) => string | null;
  /**
   * Merge one or more components into one. Takes the first component's
   * (lowest startIndex) style + color and concatenates effects from
   * every merged component. The merged component's range is:
   *   - `[firstStart, lastEnd)` if no explicit range is passed (legacy)
   *   - `[rangeStart, rangeEnd)` if a range is passed (must cover every
   *     componentId fully — used when extending a single component to
   *     absorb adjacent plain text, or merging 2+ components together
   *     with extra plain text on either side).
   * Returns the new component id, or null if no valid components were
   * named (or 1 component was named without an extending range).
   */
  mergeComponents: (
    componentIds: string[],
    range?: { start: number; end: number },
  ) => string | null;

  // Effects
  addEffect: (
    componentId: string,
    type: Effect["type"],
    startTime: number,
  ) => string | null;
  removeEffect: (componentId: string, effectId: string) => void;
  updateEffect: (
    componentId: string,
    effectId: string,
    patch: Partial<Omit<Effect, "id">>,
  ) => void;
  updateEffectTargets: (
    componentId: string,
    effectId: string,
    targets: AnimatableTargets,
  ) => void;

  // Canvas / project metadata
  setCanvasPreset: (preset: CanvasPreset) => void;
  setCanvasSize: (width: number, height: number) => void;
  setBackground: (color: string) => void;
  setDuration: (seconds: number) => void;
  setName: (name: string) => void;

  // Timeline ordering & visibility
  toggleComponentHidden: (componentId: string) => void;
  moveComponentUp: (componentId: string) => void;
  moveComponentDown: (componentId: string) => void;
}

const replaceComponent = (
  project: Project,
  componentId: string,
  fn: (c: Component) => Component | null,
): Project => {
  const layer = project.layer;
  const next: Component[] = [];
  for (const c of layer.components) {
    if (c.id !== componentId) {
      next.push(c);
      continue;
    }
    const updated = fn(c);
    if (updated) next.push(updated);
  }
  return { ...project, layer: { ...layer, components: next } };
};

export const useProjectStore = create<ProjectState>()(
  temporal((set, get) => ({
    project: initialProject(),

    setProject: (p) => set({ project: p }),

    resetToSample: () => set({ project: makeSampleProject() }),

    updateLayerText: (newText, editStart, editEnd, newLength) =>
      set((state) => {
        const adjusted = adjustRanges(
          state.project.layer.components,
          editStart,
          editEnd,
          newLength,
        );
        return {
          project: {
            ...state.project,
            layer: {
              ...state.project.layer,
              text: newText,
              components: adjusted,
            },
          },
        };
      }),

    setAlignment: (alignment) =>
      set((state) => ({
        project: {
          ...state.project,
          layer: { ...state.project.layer, alignment },
        },
      })),

    addComponent: (startIndex, endIndex, partial) => {
      if (startIndex >= endIndex) return null;
      const state = get();
      const layer = state.project.layer;

      // Overlapping ranges are now allowed (duplicates can stack on the
      // same word). The Componentize action in the editor still gates
      // against overlap via classify() in useTextSelectionMode.

      const usedColors = layer.components.map((c) => c.color);
      const color = nextColor(usedColors);

      const id = newId("comp");
      const base: ComponentStyle = {
        fontFamily: state.project.defaultTextStyle.fontFamily,
        fontSize: state.project.defaultTextStyle.fontSize,
        fontWeight: state.project.defaultTextStyle.fontWeight,
        color: state.project.defaultTextStyle.color,
        letterSpacing: 0,
        alignment: state.project.layer.alignment,
        x: 0,
        y: 0,
        opacity: 1,
        scale: 1,
        rotation: 0,
        blur: 0,
      };
      const style: ComponentStyle = { ...base, ...partial };

      const component: Component = {
        id,
        startIndex,
        endIndex,
        color,
        style,
        effects: [placeholderEffect(state.project.duration)],
      };

      set({
        project: {
          ...state.project,
          layer: {
            ...layer,
            components: [...layer.components, component],
          },
        },
      });
      return id;
    },

    removeComponent: (componentId) =>
      set((state) => ({
        project: {
          ...state.project,
          layer: {
            ...state.project.layer,
            components: state.project.layer.components.filter(
              (c) => c.id !== componentId,
            ),
          },
        },
      })),

    duplicateComponent: (componentId) => {
      let newCompId: string | null = null;
      set((state) => {
        const layer = state.project.layer;
        const src = layer.components.find((c) => c.id === componentId);
        if (!src) return state;

        // Overlapping duplicate: same text range, new color, deep-copied
        // effects with fresh ids. Layer text is NOT mutated.
        const usedColors = layer.components.map((c) => c.color);
        const newColor = nextColor(usedColors);

        const id = newId("comp");
        newCompId = id;
        const dup: Component = {
          id,
          startIndex: src.startIndex,
          endIndex: src.endIndex,
          color: newColor,
          style: { ...src.style },
          effects: src.effects.map((e) => ({
            ...e,
            id: newId("fx"),
            targets: { ...e.targets },
          })),
        };

        return {
          project: {
            ...state.project,
            layer: {
              ...layer,
              components: [...layer.components, dup],
            },
          },
        };
      });
      return newCompId;
    },

    updateComponentStyle: (componentId, patch) =>
      set((state) => ({
        project: replaceComponent(state.project, componentId, (c) => ({
          ...c,
          style: { ...c.style, ...patch },
        })),
      })),

    splitOffRange: (componentId, selStart, selEnd) => {
      if (selStart >= selEnd) return null;
      let middleId: string | null = null;
      set((state) => {
        const layer = state.project.layer;
        const idx = layer.components.findIndex((x) => x.id === componentId);
        if (idx < 0) return state;
        const c = layer.components[idx];
        if (selStart < c.startIndex || selEnd > c.endIndex) return state;

        const usedColors = layer.components.map((x) => x.color);
        const middleColor = nextColor(usedColors);
        const tailColor = nextColor([...usedColors, middleColor]);

        const newComponents: Component[] = [];
        for (let i = 0; i < layer.components.length; i++) {
          if (i !== idx) {
            newComponents.push(layer.components[i]);
            continue;
          }
          // Head — keeps style and effects
          if (selStart > c.startIndex) {
            newComponents.push({ ...c, endIndex: selStart });
          }
          // Middle — extracted, new component
          const mId = newId("comp");
          middleId = mId;
          newComponents.push({
            id: mId,
            startIndex: selStart,
            endIndex: selEnd,
            color: middleColor,
            style: { ...c.style },
            effects: [placeholderEffect(state.project.duration)],
          });
          // Tail — same style, new id + palette color. Like the middle it
          // starts with a "(no effect)" placeholder rather than an empty
          // effects array, so splitting a word never makes part of it
          // disappear.
          if (selEnd < c.endIndex) {
            newComponents.push({
              id: newId("comp"),
              startIndex: selEnd,
              endIndex: c.endIndex,
              color: tailColor,
              style: { ...c.style },
              effects: [placeholderEffect(state.project.duration)],
            });
          }
        }

        return {
          project: {
            ...state.project,
            layer: { ...layer, components: newComponents },
          },
        };
      });
      return middleId;
    },

    mergeComponents: (componentIds, range) => {
      // Need at least 1 component + a range, OR 2+ components.
      if (componentIds.length === 0) return null;
      if (componentIds.length === 1 && !range) return null;
      let mergedId: string | null = null;
      set((state) => {
        const layer = state.project.layer;
        const ids = new Set(componentIds);
        const targets = layer.components.filter((x) => ids.has(x.id));
        if (targets.length === 0) return state;
        if (targets.length === 1 && !range) return state;
        targets.sort((a, b) => a.startIndex - b.startIndex);
        const first = targets[0];
        const last = targets[targets.length - 1];

        // When a range is supplied, it must fully cover every target.
        // Otherwise fall back to [first.start, last.end).
        const startIndex = range ? Math.min(range.start, first.startIndex) : first.startIndex;
        const endIndex = range ? Math.max(range.end, last.endIndex) : last.endIndex;

        const merged: Component = {
          id: newId("comp"),
          startIndex,
          endIndex,
          color: first.color,
          style: { ...first.style },
          effects: targets.flatMap((c) => c.effects),
        };
        mergedId = merged.id;

        const remaining = layer.components.filter((x) => !ids.has(x.id));
        const next = [...remaining, merged].sort(
          (a, b) => a.startIndex - b.startIndex,
        );

        return {
          project: { ...state.project, layer: { ...layer, components: next } },
        };
      });
      return mergedId;
    },

    addEffect: (componentId, type, startTime) => {
      const id = newId("fx");
      const defaults = EFFECT_DEFAULTS[type];
      let didApply = false;
      set((state) => {
        const next = replaceComponent(state.project, componentId, (c) => {
          didApply = true;
          return {
            ...c,
            effects: [
              ...c.effects,
              {
                id,
                type,
                startTime,
                duration: defaults.duration,
                easing: defaults.easing,
                from: { ...defaults.from },
                targets: { ...defaults.targets },
                ...(type === "spotlight"
                  ? {
                      spotlight: {
                        shape: "circle" as const,
                        size: 220,
                        color: "#fbbf24",
                        opacity: 0.55,
                        motion: "mouse" as const,
                        maskText: false,
                        maskMode: "tint" as const,
                        featherPx: 0,
                        showBackdrop: true,
                      },
                    }
                  : {}),
                ...(type === "particle"
                  ? {
                      particle: {
                        density: 24,
                        size: 20,
                        color: "#fbbf24",
                        preset: "gold" as const,
                        shape: "star" as const,
                        type: "standard" as const,
                        mode: "area" as const,
                        area: defaultEffectArea(state.project.canvas),
                        spawnRadiusPx: 30,
                        lifespanSec: 0.6,
                        sizeJitter: 0.4,
                        rotationSpeed: 0,
                        continueAfter: false,
                      },
                    }
                  : {}),
                ...(type === "typewriter"
                  ? {
                      staggerLetters: true,
                      typewriter: { mode: "fade" as const },
                    }
                  : {}),
                ...(type === "fireworks-js"
                  ? {
                      fireworks: {
                        density: 50,
                        explosion: 5,
                        gravity: 1.5,
                        opacity: 0.5,
                        flickering: 50,
                        acceleration: 1.05,
                        friction: 0.97,
                        traceLength: 3,
                        traceSpeed: 10,
                        intensity: 30,
                        lineStyle: "round" as const,
                        area: defaultEffectArea(state.project.canvas, 100),
                        delayMin: 10,
                        delayMax: 60,
                        brightnessMin: 50,
                        brightnessMax: 80,
                        decayMin: 0.015,
                        decayMax: 0.03,
                        hueMin: 0,
                        hueMax: 360,
                        rocketsPointMin: 30,
                        rocketsPointMax: 70,
                        lineWidthExpMin: 1,
                        lineWidthExpMax: 3,
                        lineWidthTraceMin: 1,
                        lineWidthTraceMax: 2,
                        continueAfter: false,
                      },
                    }
                  : {}),
              },
            ],
          };
        });
        return { project: next };
      });
      return didApply ? id : null;
    },

    removeEffect: (componentId, effectId) =>
      set((state) => ({
        project: replaceComponent(state.project, componentId, (c) => ({
          ...c,
          effects: c.effects.filter((e) => e.id !== effectId),
        })),
      })),

    updateEffect: (componentId, effectId, patch) =>
      set((state) => ({
        project: replaceComponent(state.project, componentId, (c) => ({
          ...c,
          effects: c.effects.map((e) =>
            e.id === effectId ? { ...e, ...patch } : e,
          ),
        })),
      })),

    updateEffectTargets: (componentId, effectId, targets) =>
      set((state) => ({
        project: replaceComponent(state.project, componentId, (c) => ({
          ...c,
          effects: c.effects.map((e) =>
            e.id === effectId
              ? { ...e, targets: { ...e.targets, ...targets } }
              : e,
          ),
        })),
      })),

    setCanvasPreset: (preset) =>
      set((state) => {
        const spec = CANVAS_PRESETS.find((p) => p.preset === preset);
        if (!spec) return state;
        // "custom" keeps whatever width/height the user already had so the
        // switch from a fixed preset to custom doesn't reset their canvas.
        const isCustom = spec.preset === "custom";
        return {
          project: {
            ...state.project,
            canvas: {
              ...state.project.canvas,
              preset: spec.preset,
              width: isCustom ? state.project.canvas.width : spec.width,
              height: isCustom ? state.project.canvas.height : spec.height,
            },
          },
        };
      }),

    setCanvasSize: (width, height) =>
      set((state) => ({
        project: {
          ...state.project,
          canvas: {
            ...state.project.canvas,
            width: Math.max(1, Math.round(width)),
            height: Math.max(1, Math.round(height)),
          },
        },
      })),

    setBackground: (color) =>
      set((state) => ({
        project: {
          ...state.project,
          canvas: { ...state.project.canvas, background: color },
        },
      })),

    setDuration: (seconds) =>
      set((state) => ({
        project: { ...state.project, duration: Math.max(0.1, seconds) },
      })),

    setName: (name) =>
      set((state) => ({ project: { ...state.project, name } })),

    toggleComponentHidden: (componentId) =>
      set((state) => ({
        project: replaceComponent(state.project, componentId, (c) => ({
          ...c,
          hidden: !c.hidden,
        })),
      })),

    moveComponentUp: (componentId) =>
      set((state) => {
        const comps = state.project.layer.components;
        const idx = comps.findIndex((c) => c.id === componentId);
        if (idx <= 0) return state;
        const swapped = [...comps];
        [swapped[idx - 1], swapped[idx]] = [swapped[idx], swapped[idx - 1]];
        return {
          project: {
            ...state.project,
            layer: { ...state.project.layer, components: swapped },
          },
        };
      }),

    moveComponentDown: (componentId) =>
      set((state) => {
        const comps = state.project.layer.components;
        const idx = comps.findIndex((c) => c.id === componentId);
        if (idx < 0 || idx >= comps.length - 1) return state;
        const swapped = [...comps];
        [swapped[idx], swapped[idx + 1]] = [swapped[idx + 1], swapped[idx]];
        return {
          project: {
            ...state.project,
            layer: { ...state.project.layer, components: swapped },
          },
        };
      }),
  })),
);

export const useProjectTemporal = useProjectStore.temporal;
