import type { CanvasPreset } from "../types/project";

export interface CanvasPresetSpec {
  preset: CanvasPreset;
  label: string;
  width: number;
  height: number;
}

export const CANVAS_PRESETS: readonly CanvasPresetSpec[] = [
  { preset: "16:9", label: "16:9 — landscape", width: 1200, height: 675 },
  { preset: "1:1", label: "1:1 — square", width: 1080, height: 1080 },
  { preset: "9:16", label: "9:16 — portrait", width: 1080, height: 1920 },
  // "Custom" preserves the current dimensions; W/H inputs become free
  // (no aspect-ratio lock) when this preset is active.
  { preset: "custom", label: "Custom — free", width: 1200, height: 675 },
];

export const DEFAULT_PRESET = CANVAS_PRESETS[0];
