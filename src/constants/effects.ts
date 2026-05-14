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
    from: { x: -100, y: 0 },
    targets: { x: 0, y: 0 },
  },
  scale: {
    duration: 0.5,
    easing: "spring",
    from: { scale: 0.6 },
    targets: { scale: 1.2 },
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
    from: { blur: 0 },
    targets: { blur: 8 },
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
  scale: "Scale",
  rotate: "Rotate",
  "color-shift": "Color shift",
  spotlight: "Spotlight",
  particle: "Particle",
  typewriter: "Typewriter",
  "fireworks-js": "Fireworks (lib)",
  blur: "Blur",
  // "custom" is the placeholder for a blank effect — no animated props.
  // Used as the default when the user adds an effect via "+" before
  // picking a type in the modal.
  custom: "(no effect)",
};
