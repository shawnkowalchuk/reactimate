export const SNAP_SECONDS = 0.05; // 50 ms grid (Shift-drag to ignore)
export const MIN_EFFECT_DURATION = 0.05;
export const ROW_HEIGHT = 32;
export const ROW_GAP = 4;

export function snap(timeSeconds: number, snapSeconds = SNAP_SECONDS): number {
  if (snapSeconds <= 0) return timeSeconds;
  return Math.round(timeSeconds / snapSeconds) * snapSeconds;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function pxPerSecond(timelineWidth: number, duration: number): number {
  if (duration <= 0) return 0;
  return timelineWidth / duration;
}

export function tickStepFor(duration: number): number {
  // Pick a nice round tick interval given the project duration
  if (duration <= 2) return 0.25;
  if (duration <= 5) return 0.5;
  if (duration <= 10) return 1;
  if (duration <= 30) return 2;
  return 5;
}
