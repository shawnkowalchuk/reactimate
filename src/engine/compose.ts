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
  letterIndex = 0,
): ComputedStyle {
  const current: ComputedStyle = {
    opacity: c.style.opacity,
    x: c.style.x,
    y: c.style.y,
    scale: c.style.scale,
    rotation: c.style.rotation,
    color: c.style.color,
    fontSize: c.style.fontSize,
    blur: 0,
  };

  const lastValue: Record<string, unknown> = { ...current };

  // Each effect that has staggerLetters gets a per-letter time-shift of
  // (staggerDelay * letterIndex). Typewriter effects auto-derive their
  // per-letter delay from `duration / letterCount` so the whole reveal
  // finishes within the effect's duration regardless of word length.
  // Effects without staggerLetters animate the whole component in sync.
  const sorted = [...c.effects]
    .map((e) => {
      // Typewriter: shift each letter by (duration / N) so they spread
      // evenly across the effect window.
      let shift = 0;
      const charCount = Math.max(1, c.endIndex - c.startIndex);
      // For "reverse" direction, animate the last letter first by
      // inverting the per-letter index used to derive the shift.
      const effectiveIdx =
        e.staggerDirection === "reverse"
          ? Math.max(0, charCount - 1 - letterIndex)
          : letterIndex;
      if (e.type === "typewriter") {
        shift = (e.duration / charCount) * effectiveIdx;
      } else if (e.staggerLetters) {
        shift = (e.staggerDelay ?? 0.05) * effectiveIdx;
      }
      // For typewriter snap mode: collapse each letter's window to a
      // tiny step so opacity flips instantly at the scheduled time.
      const isSnap =
        e.type === "typewriter" && e.typewriter?.mode === "snap";
      const dur = isSnap ? Math.max(0.001, e.duration / 1000) : e.duration;
      return {
        effect: e,
        startTime: e.startTime + shift,
        endTime: e.startTime + shift + dur,
      };
    })
    .sort((a, b) => a.startTime - b.startTime);

  for (const { effect, startTime, endTime } of sorted) {
    for (const key of Object.keys(effect.targets) as AnimatableProp[]) {
      const target = effect.targets[key];
      if (target === undefined) continue;

      // Per-effect explicit start value (effect.from[key]) takes priority;
      // otherwise fall back to whatever the previous effect left.
      const explicitFrom = effect.from?.[key];
      const from = explicitFrom !== undefined ? explicitFrom : lastValue[key];

      if (time < startTime) {
        (current as unknown as Record<string, unknown>)[key] =from;
      } else if (time >= endTime) {
        (current as unknown as Record<string, unknown>)[key] =target;
        lastValue[key] = target;
      } else {
        const dur = endTime - startTime;
        const raw = dur <= 0 ? 1 : (time - startTime) / dur;
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

  // Visibility window: a component is only "alive" while at least one
  // of its effects is active. Outside any effect's [start, end] range
  // the component is forced to opacity=0. Empty-effects components are
  // also hidden (nothing to play).
  //
  // Special case for TYPEWRITER: once a letter's reveal has started
  // (time >= shifted startTime), it should STAY visible — typewriter
  // text doesn't disappear after it's typed. So a typewriter effect
  // counts as active any time after its start, not just within its
  // reveal duration.
  //
  // Subtlety: if the component IS active but no effect on it touches
  // opacity (e.g. only Color-shift, Spotlight, Rotate, or a "(no effect)"
  // placeholder), we still want the text visible — otherwise a perfectly
  // valid effect is silently invisible because the baseline style.opacity
  // happens to be 0. So when active without any opacity-touching effect,
  // force opacity=1.
  // For "typewriter" and "rotate" effects, we want the text to STAY
  // visible after the effect completes (at the final letter / angle).
  // Other effect types follow the standard "active during [start, end]"
  // window so the gap-hide rule kicks in after they finish.
  const isActive =
    sorted.length > 0 &&
    sorted.some(({ effect, startTime, endTime }) => {
      if (effect.type === "typewriter" || effect.type === "rotate" || effect.type === "blur") {
        return time >= startTime;
      }
      if (effect.type === "particle" && effect.particle?.continueAfter) {
        return time >= startTime;
      }
      return time >= startTime && time <= endTime;
    });
  if (!isActive) {
    current.opacity = 0;
  } else {
    const anyOpacity = sorted.some(
      ({ effect }) =>
        effect.targets?.opacity !== undefined ||
        effect.from?.opacity !== undefined,
    );
    if (!anyOpacity) {
      current.opacity = 1;
    }
  }

  return current;
}
