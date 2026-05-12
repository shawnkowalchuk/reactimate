import { create } from "zustand";

export interface TextRange {
  start: number;
  end: number;
}

export type SelectionTarget =
  | { kind: "none" }
  | { kind: "text"; range: TextRange }
  | { kind: "component"; componentId: string }
  | { kind: "effect"; componentId: string; effectId: string };

export interface SelectionState {
  target: SelectionTarget;
  selectNone: () => void;
  selectTextRange: (range: TextRange) => void;
  selectComponent: (componentId: string) => void;
  selectEffect: (componentId: string, effectId: string) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  target: { kind: "none" },
  selectNone: () => set({ target: { kind: "none" } }),
  selectTextRange: (range) => set({ target: { kind: "text", range } }),
  selectComponent: (componentId) =>
    set({ target: { kind: "component", componentId } }),
  selectEffect: (componentId, effectId) =>
    set({ target: { kind: "effect", componentId, effectId } }),
}));
