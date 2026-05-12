import type { EasingType } from "../types/project";

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export const easings: Record<EasingType, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  spring: (t) => {
    const c = 0.3;
    return 1 - Math.exp(-t / c) * Math.cos(t * 12);
  },
  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export function applyEasing(t: number, type: EasingType): number {
  return easings[type](clamp01(t));
}
