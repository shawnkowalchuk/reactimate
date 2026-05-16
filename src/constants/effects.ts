import type {
  AnimatableTargets,
  EffectType,
  EasingType,
} from "../types/project";

export interface EffectDefaults {
  duration: number;
  easing: EasingType;
  /** End values per animated prop. */
  targets: AnimatableTargets;
  /** Default start values per animated prop (lets the user see Start → End). */
  from: AnimatableTargets;
}

/*
 * Convention for new effects: ENTRANCE-style defaults.
 * - Animation starts in a hidden / off-position state (opacity 0,
 *   shifted, scaled down, blurred) and ends at the component's
 *   resting state (opacity 1, in place, scale 1, sharp).
 * - Only include props that actually animate. A keyframe like
 *   `y: 0 → 0` is noise — it adds a row to the modal that does
 *   nothing.
 * - Don't seed colors. The component's style.color is the natural
 *   start value (falls through from lastValue); seeding a hardcoded
 *   color in `from` overrides whatever the user picked and looks
 *   broken on backgrounds where that color doesn't fit.
 */
export const EFFECT_DEFAULTS: Record<EffectType, EffectDefaults> = {
  fade: {
    duration: 0.6,
    easing: "ease-out",
    from: { opacity: 0 },
    targets: { opacity: 1 },
  },
  slide: {
    duration: 0.6,
    easing: "ease-out",
    // Y-only slide — text drops down from above into its resting
    // position. Most hero animations slide vertically, not horizontally;
    // x is left out so the modal doesn't show a 0 → 0 keyframe row
    // (users can add x explicitly if they want a diagonal slide).
    from: { y: -100 },
    targets: { y: 0 },
  },
  rotate: {
    duration: 0.6,
    easing: "ease-in-out",
    from: { rotation: 0 },
    targets: { rotation: 360 },
  },
  "color-shift": {
    duration: 0.8,
    easing: "ease-in-out",
    from: { color: "#000000" },
    targets: { color: "#ffffff" },
  },
  spotlight: {
    duration: 1.0,
    easing: "ease-out",
    from: {},
    targets: {},
  },
  particle: {
    duration: 1.0,
    easing: "linear",
    from: {},
    targets: {},
  },
  typewriter: {
    duration: 1.0,
    easing: "linear",
    from: { opacity: 0 },
    targets: { opacity: 1 },
  },
  "fireworks-js": {
    duration: 2.0,
    easing: "linear",
    from: {},
    targets: {},
  },
  blur: {
    duration: 0.5,
    easing: "ease-out",
    // Blur-IN entrance: text appears blurred and sharpens into focus.
    // Previously defaulted blur: 0 → 8 (starts sharp, ends obscured)
    // which is the opposite of every other entrance default.
    from: { blur: 8 },
    targets: { blur: 0 },
  },
  zoom: {
    duration: 0.6,
    easing: "ease-out",
    // Pure scale + opacity. The previous default included `y: 20 → 0`
    // which made every new zoom effect rise from below — confusing
    // when users expected a centered zoom-in. They can still add
    // x / y keyframes explicitly via the keyframe rows if they want
    // a directional pop-in.
    from: { scale: 0.5, opacity: 0 },
    targets: { scale: 1, opacity: 1 },
  },
  custom: {
    duration: 0.5,
    easing: "ease-in-out",
    from: {},
    targets: {},
  },
};

export const EFFECT_LABELS: Record<EffectType, string> = {
  fade: "Fade",
  slide: "Slide",
  rotate: "Rotate",
  "color-shift": "Color shift",
  spotlight: "Spotlight",
  particle: "Particle",
  typewriter: "Typewriter",
  "fireworks-js": "Fireworks (lib)",
  blur: "Blur",
  zoom: "Zoom",
  // "custom" is the placeholder for a blank effect — no animated props.
  // Used as the default when the user adds an effect via "+" before
  // picking a type in the modal.
  custom: "(no effect)",
};
