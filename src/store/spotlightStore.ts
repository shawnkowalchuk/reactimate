import { create } from "zustand";

/**
 * Tracks the most recent mouse position in canvas-design coordinates so
 * the text container can mask itself against an active spotlight (and
 * the SpotlightOverlay can position its backdrop).
 */
export interface SpotlightState {
  mouse: { x: number; y: number } | null;
  setMouse: (m: { x: number; y: number } | null) => void;
}

export const useSpotlightStore = create<SpotlightState>((set) => ({
  mouse: null,
  setMouse: (mouse) => set({ mouse }),
}));
