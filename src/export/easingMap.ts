import type { EasingType } from "../types/project";

/**
 * Map our internal easing types to Motion's ease names.
 *
 * Motion accepts these strings on `transition.ease` (and per-segment
 * inside an `ease` array). For spring/bounce we approximate with the
 * nearest curve — Motion's `spring` is a transition *type* (mass/damping)
 * not a curve, so we can't drop it into a multi-keyframe ease array.
 */
export function toMotionEase(easing: EasingType): string {
  switch (easing) {
    case "linear":
      return "linear";
    case "ease-in":
      return "easeIn";
    case "ease-out":
      return "easeOut";
    case "ease-in-out":
      return "easeInOut";
    case "spring":
      return "easeOut";
    case "bounce":
      return "backOut";
  }
}
