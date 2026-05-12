import { useEffect } from "react";
import { usePlaybackStore } from "../store/playbackStore";
import { useProjectTemporal } from "../store/projectStore";

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

      // Cmd/Ctrl + Z: undo. Cmd/Ctrl + Shift + Z: redo.
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.code === "KeyZ") {
        e.preventDefault();
        const temporal = useProjectTemporal.getState();
        if (e.shiftKey) {
          temporal.redo();
        } else {
          temporal.undo();
        }
        return;
      }
      // Cmd/Ctrl + Y: redo (Windows convention)
      if (mod && e.code === "KeyY") {
        e.preventDefault();
        useProjectTemporal.getState().redo();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
