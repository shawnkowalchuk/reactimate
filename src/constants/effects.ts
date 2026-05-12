import type {
  AnimatableTargets,
  EffectType,
  EasingType,
} from "../types/project";

export interface EffectDefaults {
  duration: number;
  easing: EasingType;
  targets: AnimatableTargets;
}

export const EFFECT_DEFAULTS: Record<EffectType, EffectDefaults> = {
  fade: {
    duration: 0.6,
    easing: "ease-out",
    targets: { opacity: 1 },
  },
  slide: {
    duration: 0.6,
    easing: "ease-out",
    targets: { x: 0, y: 0 },
  },
  scale: {
    duration: 0.5,
    easing: "spring",
    targets: { scale: 1.2 },
  },
  rotate: {
    duration: 0.6,
    easing: "ease-in-out",
    targets: { rotation: 360 },
  },
  "color-shift": {
    duration: 0.8,
    easing: "ease-in-out",
    targets: { color: "#ffffff" },
  },
  custom: {
    duration: 0.5,
    easing: "ease-in-out",
    targets: {},
  },
};

export const EFFECT_LABELS: Record<EffectType, string> = {
  fade: "Fade",
  slide: "Slide",
  scale: "Scale",
  rotate: "Rotate",
  "color-shift": "Color shift",
  custom: "Custom",
};
