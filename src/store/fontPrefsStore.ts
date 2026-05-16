import { create } from "zustand";

const STORAGE_KEY = "reactimate.hiddenFonts";

function loadHidden(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === "string"));
    }
  } catch {
    // ignore — fall through to empty default
  }
  return new Set();
}

function persistHidden(hidden: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
  } catch {
    // ignore — quota / private mode
  }
}

export interface FontPrefsState {
  /**
   * Font families the user has chosen to hide from the FontPicker.
   * Persisted to localStorage so it survives reloads. Device-local
   * (not synced to the cloud) — same model as the theme preference.
   */
  hiddenFonts: Set<string>;
  isHidden: (family: string) => boolean;
  hideFont: (family: string) => void;
  showFont: (family: string) => void;
  toggleFont: (family: string) => void;
  /** Replace the entire hidden set in one shot — used for bulk ops. */
  setHidden: (next: Iterable<string>) => void;
  /** Clear all hidden fonts (show everything). */
  showAll: () => void;
}

export const useFontPrefsStore = create<FontPrefsState>((set, get) => ({
  hiddenFonts: loadHidden(),
  isHidden: (family) => get().hiddenFonts.has(family),
  hideFont: (family) => {
    const next = new Set(get().hiddenFonts);
    next.add(family);
    persistHidden(next);
    set({ hiddenFonts: next });
  },
  showFont: (family) => {
    const next = new Set(get().hiddenFonts);
    next.delete(family);
    persistHidden(next);
    set({ hiddenFonts: next });
  },
  toggleFont: (family) => {
    const next = new Set(get().hiddenFonts);
    if (next.has(family)) next.delete(family);
    else next.add(family);
    persistHidden(next);
    set({ hiddenFonts: next });
  },
  setHidden: (iter) => {
    const next = new Set(iter);
    persistHidden(next);
    set({ hiddenFonts: next });
  },
  showAll: () => {
    const empty = new Set<string>();
    persistHidden(empty);
    set({ hiddenFonts: empty });
  },
}));
