import type { EasingType } from "../types/project";
import { raw } from "./format";

/**
 * The `transition.ease` value for an effect's easing.
 *
 * The export must use the SAME easing curves as the editor preview, or
 * the animation looks subtly off. The preview's engine (engine/easing.ts)
 * uses plain quadratic curves — Motion's built-in named eases (`easeIn`
 * etc.) are cubic-beziers and don't match. So every non-linear easing
 * resolves to an `EASE[...]` lookup; the exported file carries an `EASE`
 * table that is a verbatim copy of the engine's curves (see
 * `easeHelperSource`). `linear` is identical everywhere, so it stays a
 * plain string.
 */
export function toMotionEase(easing: EasingType): unknown {
  return easing === "linear" ? "linear" : raw(`EASE[${JSON.stringify(easing)}]`);
}

/** True iff any non-linear easing is in use (so the EASE table is needed). */
export function usesEaseHelper(easings: EasingType[]): boolean {
  return easings.some((e) => e !== "linear");
}

/**
 * Module-scope `EASE` table for the exported file — a verbatim copy of
 * `engine/easing.ts` so exported animations ease exactly like the editor.
 */
export function easeHelperSource(): string {
  return `// Easing curves — exact copies of the reactimate engine, so the
// exported animation eases identically to the editor preview.
const EASE = {
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  spring: (t) => 1 - Math.exp(-t / 0.3) * Math.cos(t * 12),
  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};`;
}
