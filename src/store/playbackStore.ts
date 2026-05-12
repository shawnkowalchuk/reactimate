import { create } from "zustand";

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  togglePlaying: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  togglePlaying: () => set({ isPlaying: !get().isPlaying }),
}));
