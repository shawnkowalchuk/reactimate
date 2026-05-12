import { useEffect, useRef } from "react";
import { useProjectStore } from "../store/projectStore";
import { saveToStorage } from "./localStorage";

const DEBOUNCE_MS = 400;

/**
 * Autosave the project to localStorage on change, debounced.
 * Mounted once at the App level.
 */
export function useAutosave() {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = useProjectStore.subscribe((state, prev) => {
      if (state.project === prev.project) return;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        saveToStorage(useProjectStore.getState().project);
        timerRef.current = null;
      }, DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);
}
