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
  updateComponentStyle: (
    componentId: string,
    patch: Partial<ComponentStyle>,
  ) => void;

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
    project: makeSampleProject(),

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

      // Reject overlap.
      for (const c of layer.components) {
        if (startIndex < c.endIndex && endIndex > c.startIndex) return null;
      }

      const usedColors = layer.components.map((c) => c.color);
      const color = nextColor(usedColors);

      const id = newId("comp");
      const base: ComponentStyle = {
        fontFamily: state.project.defaultTextStyle.fontFamily,
        fontSize: state.project.defaultTextStyle.fontSize,
        fontWeight: state.project.defaultTextStyle.fontWeight,
        color: state.project.defaultTextStyle.color,
        letterSpacing: 0,
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

    updateComponentStyle: (componentId, patch) =>
      set((state) => ({
        project: replaceComponent(state.project, componentId, (c) => ({
          ...c,
          style: { ...c.style, ...patch },
        })),
      })),

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
                targets: { ...defaults.targets },
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
        return {
          project: {
            ...state.project,
            canvas: {
              ...state.project.canvas,
              preset: spec.preset,
              width: spec.width,
              height: spec.height,
            },
          },
        };
      }),

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
