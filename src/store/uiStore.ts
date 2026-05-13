import { create } from "zustand";

export interface EffectModalTarget {
  componentId: string;
  effectId: string;
}

export interface UIState {
  /** When non-null, the EffectModal is open for this effect. */
  effectModal: EffectModalTarget | null;
  openEffectModal: (componentId: string, effectId: string) => void;
  closeEffectModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  effectModal: null,
  openEffectModal: (componentId, effectId) =>
    set({ effectModal: { componentId, effectId } }),
  closeEffectModal: () => set({ effectModal: null }),
}));
