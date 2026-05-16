import { useCallback, useEffect, useRef } from "react";
import { useProjectStore } from "../store/projectStore";
import { usePlaybackStore } from "../store/playbackStore";
import { computeComponentStyle, computeTypewriterShape } from "../engine/compose";
import type { Component, Effect } from "../types/project";

/**
 * Drives playback by writing directly to the DOM via refs registered
 * by the preview spans. React is not re-rendered on every frame.
 *
 * Returns `registerElement(componentId, el | null)` which RenderedText
 * passes to its span ref callbacks.
 */
export function useAnimationEngine() {
  const project = useProjectStore((s) => s.project);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);

  const elementsRef = useRef<Map<string, HTMLElement>>(new Map());
  // Parallel registration channel for per-letter typewriter shape elements.
  // Same key convention (`componentId|letterIndex`); the engine looks up the
  // typewriter effect on the component and calls computeTypewriterShape.
  const shapesRef = useRef<Map<string, HTMLElement>>(new Map());
  const rafRef = useRef<number | null>(null);

  const writeShape = (
    el: HTMLElement,
    component: Component,
    letterIndex: number,
    time: number,
  ) => {
    const tw = component.effects.find(
      (e: Effect) => e.type === "typewriter" && e.typewriter?.shape,
    );
    if (!tw) return;
    const totalLetters = Math.max(1, component.endIndex - component.startIndex);
    const shape = computeTypewriterShape(tw, totalLetters, letterIndex, time);
    if (!shape) return;
    el.style.width = `${shape.size}px`;
    el.style.height = `${shape.size}px`;
    el.style.opacity = String(shape.opacity);
    el.style.filter = shape.blur > 0 ? `blur(${shape.blur}px)` : "";
    el.style.visibility = shape.visible ? "visible" : "hidden";
  };

  const apply = useCallback(
    (time: number) => {
      // Element keys are either `componentId` (whole-component) or
      // `componentId|letterIndex` (per-letter, when an effect on the
      // component opts into staggerLetters).
      for (const [key, el] of elementsRef.current) {
        const sep = key.indexOf("|");
        const componentId = sep === -1 ? key : key.slice(0, sep);
        const letterIndex = sep === -1 ? 0 : parseInt(key.slice(sep + 1), 10);
        const c = project.layer.components.find((x) => x.id === componentId);
        if (!c) continue;
        const clamped = Math.min(time, project.duration);
        const s = computeComponentStyle(c, clamped, letterIndex);
        // Anchor scale at the bottom of the line box (≈ baseline +
        // descender). For shrink animations (e.g. scale 5 → 1) the
        // bottom of the text stays put while the top contracts down
        // into place — reads as "settling into place" instead of the
        // default center-anchor's "sliding up while shrinking." Same
        // works for grow (scale 0.5 → 1): text rises from baseline
        // into final size. Static for every element — could be set
        // once at mount, but setting here keeps mount + tick paths
        // identical and the cost is one string assignment per frame.
        el.style.transformOrigin = "50% 100%";
        el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.scale}) rotate(${s.rotation}deg)`;
        el.style.opacity = String(s.opacity);
        el.style.color = s.color;
        el.style.fontSize = `${s.fontSize}px`;
        el.style.filter = s.blur > 0 ? `blur(${s.blur}px)` : "";
      }
      // Same loop over registered shape elements.
      for (const [key, el] of shapesRef.current) {
        const sep = key.indexOf("|");
        const componentId = sep === -1 ? key : key.slice(0, sep);
        const letterIndex = sep === -1 ? 0 : parseInt(key.slice(sep + 1), 10);
        const c = project.layer.components.find((x) => x.id === componentId);
        if (!c) continue;
        const clamped = Math.min(time, project.duration);
        writeShape(el, c, letterIndex, clamped);
      }
    },
    [project],
  );

  // Drive playback with RAF
  useEffect(() => {
    if (!isPlaying) return;

    let startMs =
      performance.now() - usePlaybackStore.getState().currentTime * 1000;

    const tick = (now: number) => {
      const t = (now - startMs) / 1000;
      if (t >= project.duration) {
        const looping = usePlaybackStore.getState().loop;
        if (looping) {
          const overflow = t - project.duration;
          startMs = now - overflow * 1000;
          apply(overflow);
          setCurrentTime(overflow);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const hasContinueAfter = project.layer.components.some((c) =>
          c.effects.some(
            (e) =>
              e.type === "particle" &&
              e.particle?.continueAfter &&
              e.startTime + e.duration >= project.duration - 0.001,
          ),
        );
        if (hasContinueAfter) {
          apply(t);
          setCurrentTime(t);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        apply(project.duration);
        setCurrentTime(project.duration);
        setPlaying(false);
        return;
      }
      apply(t);
      setCurrentTime(t);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, project, apply, setCurrentTime, setPlaying]);

  // Scrubbing while paused — apply immediately
  useEffect(() => {
    if (!isPlaying) apply(currentTime);
  }, [currentTime, isPlaying, apply]);

  const registerElement = useCallback(
    (id: string, el: HTMLElement | null) => {
      if (el) {
        elementsRef.current.set(id, el);
        // Apply current state so a freshly mounted span doesn't flash.
        const time = usePlaybackStore.getState().currentTime;
        const sep = id.indexOf("|");
        const componentId = sep === -1 ? id : id.slice(0, sep);
        const letterIndex = sep === -1 ? 0 : parseInt(id.slice(sep + 1), 10);
        const component = project.layer.components.find(
          (c) => c.id === componentId,
        );
        if (component) {
          const clamped = Math.min(time, project.duration);
          const s = computeComponentStyle(component, clamped, letterIndex);
          // See comment in `apply` above — anchor scale at the bottom
          // of the line box so the baseline stays put during scale
          // animations. Set on mount so the first paint matches the
          // tick-loop's later writes.
          el.style.transformOrigin = "50% 100%";
          el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.scale}) rotate(${s.rotation}deg)`;
          el.style.opacity = String(s.opacity);
          el.style.color = s.color;
          el.style.fontSize = `${s.fontSize}px`;
          el.style.filter = s.blur > 0 ? `blur(${s.blur}px)` : "";
        }
      } else {
        elementsRef.current.delete(id);
      }
    },
    [project],
  );

  const registerShape = useCallback(
    (id: string, el: HTMLElement | null) => {
      if (el) {
        shapesRef.current.set(id, el);
        // Apply current state so a freshly mounted shape doesn't flash.
        const time = usePlaybackStore.getState().currentTime;
        const sep = id.indexOf("|");
        const componentId = sep === -1 ? id : id.slice(0, sep);
        const letterIndex = sep === -1 ? 0 : parseInt(id.slice(sep + 1), 10);
        const component = project.layer.components.find(
          (c) => c.id === componentId,
        );
        if (component) {
          const clamped = Math.min(time, project.duration);
          writeShape(el, component, letterIndex, clamped);
        }
      } else {
        shapesRef.current.delete(id);
      }
    },
    [project],
  );

  return { registerElement, registerShape };
}

export type RegisterElement = (id: string, el: HTMLElement | null) => void;
export type RegisterShape = (id: string, el: HTMLElement | null) => void;
