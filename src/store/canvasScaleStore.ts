import { create } from "zustand";

/**
 * Shared canvas display scale across the editor and preview panes.
 *
 * Each pane registers the max scale that would fit its own pane.
 * Both panes then render at the MIN of all registered scales, so they
 * always look the same size on screen (the smaller pane drives).
 */
export interface CanvasScaleState {
  fitScales: Record<string, number>;
  registerFit: (id: string, scale: number) => void;
  unregisterFit: (id: string) => void;
}

export const useCanvasScaleStore = create<CanvasScaleState>((set) => ({
  fitScales: {},
  registerFit: (id, scale) =>
    set((s) => ({ fitScales: { ...s.fitScales, [id]: scale } })),
  unregisterFit: (id) =>
    set((s) => {
      const next = { ...s.fitScales };
      delete next[id];
      return { fitScales: next };
    }),
}));

/** Returns the MIN of all registered fit scales (or fallback). */
export function selectSharedScale(state: CanvasScaleState, fallback = 1): number {
  const values = Object.values(state.fitScales);
  if (values.length === 0) return fallback;
  return Math.max(0.05, Math.min(...values));
}
