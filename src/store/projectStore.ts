import { create } from "zustand";
import { temporal } from "zundo";
import type {
  AnimatableTargets,
  CanvasPreset,
  Component,
  ComponentStyle,
  Effect,
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
   * Merge two or more components into one. Takes the first component's
   * (lowest startIndex) style + color; spans `[firstStart, lastEnd)`;
   * concatenates effects from every merged component. Returns the new
   * component id, or null if fewer than 2 valid components were named.
   */
  mergeComponents: (componentIds: string[]) => string | null;

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
      };
      const style: ComponentStyle = { ...base, ...partial };

      const component: Component = {
        id,
        startIndex,
        endIndex,
        color,
        style,
        effects: [],
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
            effects: [],
          });
          // Tail — same style, no effects, new id + palette color
          if (selEnd < c.endIndex) {
            newComponents.push({
              id: newId("comp"),
              startIndex: selEnd,
              endIndex: c.endIndex,
              color: tailColor,
              style: { ...c.style },
              effects: [],
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

    mergeComponents: (componentIds) => {
      if (componentIds.length < 2) return null;
      let mergedId: string | null = null;
      set((state) => {
        const layer = state.project.layer;
        const ids = new Set(componentIds);
        const targets = layer.components.filter((x) => ids.has(x.id));
        if (targets.length < 2) return state;
        targets.sort((a, b) => a.startIndex - b.startIndex);
        const first = targets[0];
        const last = targets[targets.length - 1];

        const merged: Component = {
          id: newId("comp"),
          startIndex: first.startIndex,
          endIndex: last.endIndex,
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
                        mode: "component" as const,
                        rangePx: 20,
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
  })),
);

export const useProjectTemporal = useProjectStore.temporal;
