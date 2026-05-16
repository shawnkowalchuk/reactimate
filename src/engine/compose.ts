import type {
  AnimatableProp,
  Component,
  ComputedStyle,
  Effect,
} from "../types/project";
import { applyEasing } from "./easing";
import { lerpProperty } from "./interpolate";

/** Result of `computeTypewriterShape` — applied to the per-letter shape DOM. */
export interface ComputedShape {
  /** px, applied as both width and height. */
  size: number;
  /** px, applied via `filter: blur(<n>px)`. */
  blur: number;
  /** 0..1, applied to `opacity`. */
  opacity: number;
  /** false before the letter's window starts; caller hides the element. */
  visible: boolean;
}

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
      // When stagger is active, later letters get less time so they all
      // reach their targets by the effect's nominal end time.
      const dur = isSnap
        ? Math.max(0.001, e.duration / 1000)
        : shift > 0
          ? Math.max(0.001, e.duration - shift)
          : e.duration;
      return {
        effect: e,
        startTime: e.startTime + shift,
        endTime: e.startTime + shift + dur,
      };
    })
    .sort((a, b) => a.startTime - b.startTime);

  for (const { effect, startTime, endTime } of sorted) {
    // Loop math: `repeat` lets the effect cycle. repeat = 0/undefined
    // plays once (original behavior). repeat = N plays N+1 times total.
    // `loopForever` cycles continuously WITHIN the effect's own window
    // (the bar on the timeline). `repeatDelay` pauses between cycles
    // holding at the target value. Skipped for particle / fireworks-js
    // — those use `continueAfter` for spawner looping.
    const baseDur = endTime - startTime;
    const loopable =
      effect.type !== "particle" && effect.type !== "fireworks-js";
    const loopForever = loopable && Boolean(effect.loopForever);
    // Back-compat: Infinity stored on `repeat` (from before the
    // dedicated loopForever field existed) is treated as loopForever.
    // It won't survive JSON serialization, but in-session it works.
    const repeatRaw = loopable ? effect.repeat ?? 0 : 0;
    const repeat = loopForever || !Number.isFinite(repeatRaw) ? 0 : repeatRaw;
    const isInfinite = loopForever || !Number.isFinite(repeatRaw);
    const repeatDelay = loopable ? Math.max(0, effect.repeatDelay ?? 0) : 0;
    const cycleSpan = baseDur + repeatDelay;
    // How long this effect actively occupies the timeline. For infinite
    // loops the cycling is bounded by the effect's own window (baseDur);
    // for finite repeats we play (repeat + 1) cycles total and let
    // gap-hide kick in after.
    const totalSpan = isInfinite
      ? baseDur
      : Math.max(0, (repeat + 1) * cycleSpan - repeatDelay);

    for (const key of Object.keys(effect.targets) as AnimatableProp[]) {
      const target = effect.targets[key];
      if (target === undefined) continue;

      // Per-effect explicit start value (effect.from[key]) takes priority;
      // otherwise fall back to whatever the previous effect left.
      const explicitFrom = effect.from?.[key];
      const from = explicitFrom !== undefined ? explicitFrom : lastValue[key];

      const sinceStart = time - startTime;
      if (sinceStart < 0) {
        (current as unknown as Record<string, unknown>)[key] = from;
      } else if (sinceStart >= totalSpan) {
        // Past the last cycle — hold at target, leak to next effect.
        // Also handles zero-duration effects (totalSpan = 0 → instant snap).
        // Applies to both finite-repeat (after all cycles) and loopForever
        // (after window end).
        (current as unknown as Record<string, unknown>)[key] = target;
        lastValue[key] = target;
      } else {
        // Within an active cycle (or repeatDelay gap between cycles).
        // No-loop case: cycleT IS sinceStart. Looping case: modulo over
        // cycleSpan so repeated cycles play back-to-back (with optional
        // repeatDelay gap that holds at target between them).
        const cycling = isInfinite || repeat > 0;
        const cycleT = !cycling || cycleSpan <= 0 ? sinceStart : sinceStart % cycleSpan;
        if (cycleT >= baseDur) {
          // We're in the repeatDelay gap → hold at target until next cycle.
          (current as unknown as Record<string, unknown>)[key] = target;
        } else {
          // Guard zero baseDur against divide-by-zero (snap to target).
          const raw = baseDur <= 0 ? 1 : cycleT / baseDur;
          const eased = applyEasing(raw, effect.easing);
          (current as unknown as Record<string, unknown>)[key] = lerpProperty(
            key,
            from,
            target,
            eased,
          );
        }
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
      if (effect.type === "typewriter" || effect.type === "rotate" || effect.type === "blur" || effect.type === "zoom") {
        return time >= startTime;
      }
      if (effect.type === "particle" && effect.particle?.continueAfter) {
        return time >= startTime;
      }
      // Loop-aware end: a repeating effect stays "active" for its full
      // (repeat + 1) cycles. loopForever cycles WITHIN the effect's own
      // [start, end] window — past that, gap-hide kicks in normally.
      // repeat = 0 / undefined falls back to the single [start, end].
      const loopable = effect.type !== "particle" && effect.type !== "fireworks-js";
      const baseDur = endTime - startTime;
      const repeatDelay = Math.max(0, effect.repeatDelay ?? 0);
      const loopForever = loopable && Boolean(effect.loopForever);
      const repeatRaw = loopable ? effect.repeat ?? 0 : 0;
      // Pre-loopForever back-compat: Infinity-as-repeat (won't survive
      // JSON serialization but in-session works) also bounds to window.
      if (loopForever || !Number.isFinite(repeatRaw)) {
        return time >= startTime && time <= endTime;
      }
      const effectiveEnd = repeatRaw > 0
        ? startTime + (repeatRaw + 1) * (baseDur + repeatDelay) - repeatDelay
        : endTime;
      return time >= startTime && time <= effectiveEnd;
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

/**
 * Compute the per-letter shape state for a typewriter effect at `time`.
 * Mirrors the per-letter time-shift logic in `computeComponentStyle` so
 * the shape's animation lines up exactly with the letter's reveal:
 *  - Each letter's window is `[start + (duration/N) * idx, start + (duration/N) * (idx+1))`.
 *  - `staggerDirection: "reverse"` flips `idx` so the last letter goes first.
 *  - Before the window starts → returns the start values + `visible: false`
 *    so the caller can hide the element entirely (avoids a flash at sizeFrom).
 *  - After the window ends → holds at the end values (visible). Lets the
 *    user control "stays visible" vs "vanishes" purely via `fadeTo`.
 *
 * Returns `null` when the effect isn't a typewriter or has no shape config.
 */
export function computeTypewriterShape(
  effect: Effect,
  totalLetters: number,
  letterIndex: number,
  time: number,
): ComputedShape | null {
  if (effect.type !== "typewriter" || !effect.typewriter?.shape) return null;
  const shape = effect.typewriter.shape;
  const n = Math.max(1, totalLetters);
  const perLetter = effect.duration / n;
  const idx =
    effect.staggerDirection === "reverse"
      ? Math.max(0, n - 1 - letterIndex)
      : letterIndex;
  const start = effect.startTime + perLetter * idx;
  const end = start + perLetter;

  if (time < start) {
    return {
      size: shape.sizeFrom,
      blur: shape.blurFrom,
      opacity: shape.fadeFrom,
      visible: false,
    };
  }
  if (time >= end || perLetter <= 0) {
    // Once the per-letter reveal window has finished, hold at the End
    // values. When `snapOff` is set the shape vanishes instantly (opacity
    // forced to 0) instead — useful for shapes that reveal a letter and
    // then get out of the way.
    return {
      size: shape.sizeTo,
      blur: shape.blurTo,
      opacity: shape.snapOff ? 0 : shape.fadeTo,
      visible: !shape.snapOff,
    };
  }
  const raw = (time - start) / perLetter;
  const eased = applyEasing(raw, effect.easing);
  return {
    size: shape.sizeFrom + (shape.sizeTo - shape.sizeFrom) * eased,
    blur: shape.blurFrom + (shape.blurTo - shape.blurFrom) * eased,
    opacity: shape.fadeFrom + (shape.fadeTo - shape.fadeFrom) * eased,
    visible: true,
  };
}
