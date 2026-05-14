import { create } from "zustand";

/**
 * Per-pane fit-scale tracking and independent zoom control.
 *
 * Each pane registers its fit scale (how much the canvas shrinks to
 * fill the available pane). A per-pane zoom multiplier is applied on
 * top, so the editor and preview can be independently zoomed.
 */
export interface CanvasScaleState {
  fitScales: Record<string, number>;
  registerFit: (id: string, scale: number) => void;
  unregisterFit: (id: string) => void;
  /** Per-pane zoom multipliers (default 1.0 = 100%). */
  zoomLevels: Record<string, number>;
  setZoom: (id: string, zoom: number) => void;
}

export const useCanvasScaleStore = create<CanvasScaleState>((set) => ({
  fitScales: {},
  zoomLevels: {},
  registerFit: (id, scale) =>
    set((s) => ({ fitScales: { ...s.fitScales, [id]: scale } })),
  unregisterFit: (id) =>
    set((s) => {
      const next = { ...s.fitScales };
      delete next[id];
      return { fitScales: next };
    }),
  setZoom: (id, zoom) =>
    set((s) => ({ zoomLevels: { ...s.zoomLevels, [id]: Math.max(0.25, Math.min(4, zoom)) } })),
}));

/** Returns the MIN of all registered fit scales (or fallback). */
export function selectSharedScale(state: CanvasScaleState, fallback = 1): number {
  const values = Object.values(state.fitScales);
  if (values.length === 0) return fallback;
  return Math.max(0.05, Math.min(...values));
}
