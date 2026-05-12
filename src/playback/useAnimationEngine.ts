import { useCallback, useEffect, useRef } from "react";
import { useProjectStore } from "../store/projectStore";
import { usePlaybackStore } from "../store/playbackStore";
import { computeComponentStyle } from "../engine/compose";

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
  const rafRef = useRef<number | null>(null);

  const apply = useCallback(
    (time: number) => {
      for (const c of project.layer.components) {
        const el = elementsRef.current.get(c.id);
        if (!el) continue;
        const s = computeComponentStyle(c, time);
        el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.scale}) rotate(${s.rotation}deg)`;
        el.style.opacity = String(s.opacity);
        el.style.color = s.color;
        el.style.fontSize = `${s.fontSize}px`;
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
          // Wrap. Reset the anchor so the next frame's `t` is back near 0,
          // but carry any overflow so we don't lose a frame at very-short
          // durations.
          const overflow = t - project.duration;
          startMs = now - overflow * 1000;
          apply(overflow);
          setCurrentTime(overflow);
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
        const component = project.layer.components.find((c) => c.id === id);
        if (component) {
          const s = computeComponentStyle(component, time);
          el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.scale}) rotate(${s.rotation}deg)`;
          el.style.opacity = String(s.opacity);
          el.style.color = s.color;
          el.style.fontSize = `${s.fontSize}px`;
        }
      } else {
        elementsRef.current.delete(id);
      }
    },
    [project],
  );

  return { registerElement };
}

export type RegisterElement = (id: string, el: HTMLElement | null) => void;
