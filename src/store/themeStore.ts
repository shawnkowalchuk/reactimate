import { create } from "zustand";

export type Theme = "dark" | "light";

const STORAGE_KEY = "reactimate.theme";
const DEFAULT_THEME: Theme = "dark";

function loadTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

function persistTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function applyThemeClass(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: loadTheme(),
  setTheme: (theme) => {
    persistTheme(theme);
    applyThemeClass(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    persistTheme(next);
    applyThemeClass(next);
    set({ theme: next });
  },
}));

// Apply the initial theme synchronously, before React mounts, so the first
// paint matches the persisted preference (no flash of opposite theme).
if (typeof document !== "undefined") {
  applyThemeClass(loadTheme());
}
