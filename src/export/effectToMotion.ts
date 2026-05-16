import type {
  AnimatableProp,
  AnimatableTargets,
  Component,
  ComponentStyle,
  Effect,
} from "../types/project";
import { toMotionEase } from "./easingMap";

/**
 * Motion uses `rotate` (not `rotation`) and accepts `x`/`y` as direct
 * motion values. Map our internal animatable prop names to Motion's.
 */
const PROP_TO_MOTION: Record<AnimatableProp, string> = {
  opacity: "opacity",
  x: "x",
  y: "y",
  scale: "scale",
  rotation: "rotate",
  color: "color",
  fontSize: "fontSize",
  blur: "filter",
};

const PROP_TO_STYLE: Record<AnimatableProp, keyof ComponentStyle> = {
  opacity: "opacity",
  x: "x",
  y: "y",
  scale: "scale",
  rotation: "rotation",
  color: "color",
  fontSize: "fontSize",
  blur: "blur",
};

type PropValue = number | string;

export interface PerPropTransition {
  /** Effects-driven keyframes for ONE property of a component. */
  motionProp: string;
  initial: PropValue;
  /** When there's a single effect, `animate` is the target. Otherwise array. */
  animate: PropValue | PropValue[];
  transition: Record<string, unknown>;
}

export interface ComponentMotion {
  initial: Record<string, PropValue>;
  animate: Record<string, PropValue | PropValue[]>;
  transition: Record<string, unknown>;
  /** True when no effects animate any property — caller may skip `motion.`. */
  isStatic: boolean;
}

function getEffectsTouching(
  effects: Effect[],
  prop: AnimatableProp,
): Effect[] {
  return effects
    .filter((e) => e.targets[prop] !== undefined)
    .sort((a, b) => a.startTime - b.startTime);
}

function getStartValue(
  style: ComponentStyle,
  prop: AnimatableProp,
): PropValue {
  return style[PROP_TO_STYLE[prop]] as PropValue;
}

/**
 * Build the per-property transition for a single component property
 * that is animated by one or more effects.
 *
 * Single-effect form (idiomatic, clean):
 *   initial: 0
 *   animate: 1
 *   transition: { delay, duration, ease }
 *
 * Multi-effect form (keyframes):
 *   initial: 0
 *   animate: [0, 1, 1, 0.3]
 *   transition: { duration, times: [...], ease: [...] }
 */
export function buildPropTransition(
  component: Component,
  prop: AnimatableProp,
  totalDuration: number,
): PerPropTransition | null {
  const effects = getEffectsTouching(component.effects, prop);
  if (effects.length === 0) return null;

  const start = getStartValue(component.style, prop);

  if (effects.length === 1) {
    const e = effects[0];
    const transition: Record<string, unknown> = {
      delay: e.startTime,
      duration: e.duration,
      ease: toMotionEase(e.easing),
    };
    // Loop: maps to motion's transition.repeat. loopForever computes
    // how many cycles fit inside the effect's window so the export
    // matches the editor preview (which bounds loops to the window).
    // Finite N is emitted as-is. repeatDelay only matters when repeating.
    const cycleSpan = e.duration + Math.max(0, e.repeatDelay ?? 0);
    if (e.loopForever && cycleSpan > 0) {
      // floor(window / cycle) cycles fit cleanly; subtract 1 because
      // motion's repeat=N plays (N+1) times total.
      const fits = Math.max(0, Math.floor(e.duration / cycleSpan) - 1);
      if (fits > 0) {
        transition.repeat = fits;
        if (e.repeatDelay && e.repeatDelay > 0) {
          transition.repeatDelay = e.repeatDelay;
        }
      }
    } else if (e.repeat !== undefined && e.repeat !== 0 && Number.isFinite(e.repeat)) {
      transition.repeat = e.repeat;
      if (e.repeatDelay && e.repeatDelay > 0) {
        transition.repeatDelay = e.repeatDelay;
      }
    }
    return {
      motionProp: PROP_TO_MOTION[prop],
      initial: start,
      animate: e.targets[prop] as PropValue,
      transition,
    };
  }

  // Multi-effect: keyframes
  const times: number[] = [];
  const values: PropValue[] = [];
  const eases: string[] = [];

  let lastValue = start;
  let lastTime = 0;

  // First keyframe: t=0, start value
  times.push(0);
  values.push(start);

  for (const e of effects) {
    // Hold from lastTime to e.startTime at lastValue
    if (e.startTime > lastTime) {
      times.push(e.startTime);
      values.push(lastValue);
      eases.push("linear");
      lastTime = e.startTime;
    }
    // The effect itself
    const target = e.targets[prop] as PropValue;
    const endTime = Math.min(e.startTime + e.duration, totalDuration);
    times.push(endTime);
    values.push(target);
    eases.push(toMotionEase(e.easing));
    lastTime = endTime;
    lastValue = target;
  }

  // Extend to total duration
  if (lastTime < totalDuration) {
    times.push(totalDuration);
    values.push(lastValue);
    eases.push("linear");
  }

  // Normalize times to 0..1
  const normTimes = times.map((t) =>
    totalDuration > 0 ? +(t / totalDuration).toFixed(6) : 0,
  );

  return {
    motionProp: PROP_TO_MOTION[prop],
    initial: start,
    animate: values,
    transition: {
      duration: totalDuration,
      times: normTimes,
      ease: eases,
    },
  };
}

function transitionsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Aggregate per-property transitions into a single Motion `transition`
 * prop. If all transitions are identical, consolidate to one shared
 * transition object (cleaner output). Otherwise keep them per-property.
 */
export function buildComponentMotion(
  component: Component,
  totalDuration: number,
): ComponentMotion {
  const props = Object.keys(PROP_TO_MOTION) as AnimatableProp[];

  const perProp = props
    .map((p) => buildPropTransition(component, p, totalDuration))
    .filter((p): p is PerPropTransition => p !== null);

  if (perProp.length === 0) {
    return {
      initial: {},
      animate: {},
      transition: {},
      isStatic: true,
    };
  }

  const initial: Record<string, PropValue> = {};
  const animate: Record<string, PropValue | PropValue[]> = {};
  for (const p of perProp) {
    initial[p.motionProp] = p.initial;
    animate[p.motionProp] = p.animate;
  }

  // Try to consolidate: if every prop's transition is identical, use one shared.
  const allSame =
    perProp.length > 1 &&
    perProp.every((p) => transitionsEqual(p.transition, perProp[0].transition));

  let transition: Record<string, unknown>;
  if (allSame || perProp.length === 1) {
    transition = perProp[0].transition;
  } else {
    transition = {};
    for (const p of perProp) {
      transition[p.motionProp] = p.transition;
    }
  }

  return { initial, animate, transition, isStatic: false };
}

export function listAnimatedProps(targets: AnimatableTargets): AnimatableProp[] {
  return Object.keys(targets) as AnimatableProp[];
}
