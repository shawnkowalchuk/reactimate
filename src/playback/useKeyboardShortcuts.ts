import { useEffect } from "react";
import { usePlaybackStore } from "../store/playbackStore";

const isTypingElement = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
};

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingElement(e.target)) return;

      // Space: play/pause
      if (e.code === "Space") {
        e.preventDefault();
        usePlaybackStore.getState().togglePlaying();
        return;
      }

      // Home: jump to t=0
      if (e.code === "Home") {
        e.preventDefault();
        usePlaybackStore.getState().setCurrentTime(0);
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
