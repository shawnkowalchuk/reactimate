import type {
  AnimatableProp,
  Component,
  ComputedStyle,
} from "../types/project";
import { applyEasing } from "./easing";
import { lerpProperty } from "./interpolate";

/**
 * Compute the visual style of a component at a given time.
 *
 * Contract: every animatable property starts at its value on
 * `component.style`. Effects animate FROM the previous value of
 * that property TO their `targets` entry. When multiple effects
 * touch the same property, they are applied in time order — the
 * "from" of each effect is the most recently completed value.
 */
export function computeComponentStyle(
  c: Component,
  time: number,
): ComputedStyle {
  const current: ComputedStyle = {
    opacity: c.style.opacity,
    x: c.style.x,
    y: c.style.y,
    scale: c.style.scale,
    rotation: c.style.rotation,
    color: c.style.color,
    fontSize: c.style.fontSize,
  };

  const lastValue: Record<string, unknown> = { ...current };

  const sorted = [...c.effects].sort((a, b) => a.startTime - b.startTime);

  for (const effect of sorted) {
    const endTime = effect.startTime + effect.duration;

    for (const key of Object.keys(effect.targets) as AnimatableProp[]) {
      const target = effect.targets[key];
      if (target === undefined) continue;

      const from = lastValue[key];

      if (time < effect.startTime) {
        (current as unknown as Record<string, unknown>)[key] =from;
      } else if (time >= endTime) {
        (current as unknown as Record<string, unknown>)[key] =target;
        lastValue[key] = target;
      } else {
        const raw =
          effect.duration === 0
            ? 1
            : (time - effect.startTime) / effect.duration;
        const eased = applyEasing(raw, effect.easing);
        (current as unknown as Record<string, unknown>)[key] =lerpProperty(
          key,
          from,
          target,
          eased,
        );
      }
    }
  }

  return current;
}
