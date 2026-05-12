import { create } from "zustand";

const LOOP_STORAGE_KEY = "reactimate.loop";

const initialLoop = (() => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOOP_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
})();

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  loop: boolean;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  togglePlaying: () => void;
  setLoop: (loop: boolean) => void;
  toggleLoop: () => void;
}

function persistLoop(loop: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOOP_STORAGE_KEY, loop ? "1" : "0");
  } catch {
    // ignore
  }
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  loop: initialLoop,
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  togglePlaying: () => set({ isPlaying: !get().isPlaying }),
  setLoop: (loop) => {
    persistLoop(loop);
    set({ loop });
  },
  toggleLoop: () => {
    const next = !get().loop;
    persistLoop(next);
    set({ loop: next });
  },
}));
