import { create } from "zustand";
import type { Effect, EffectType } from "../types/project";

/**
 * The subset of an effect that survives saving as a preset. Excludes
 * id and startTime — those are per-instance, not part of the look.
 */
export type PresetConfig = Pick<
  Effect,
  | "type"
  | "duration"
  | "easing"
  | "from"
  | "targets"
  | "spotlight"
  | "sparkle"
  | "typewriter"
  | "staggerLetters"
  | "staggerDelay"
>;

export interface PresetRecord {
  id: string;
  name: string;
  effectType: EffectType;
  config: PresetConfig;
  createdAt: number;
}

/**
 * Storage abstraction. The default `LocalStorageBackend` keeps presets
 * in browser localStorage; a future Postgres-backed implementation
 * (REST/RPC, async) drops in here without UI changes.
 */
export interface PresetStorage {
  list(): Promise<PresetRecord[]>;
  save(input: Omit<PresetRecord, "id" | "createdAt">): Promise<PresetRecord>;
  delete(id: string): Promise<void>;
  /** Replace all stored presets (used by Import). */
  bulkPut(records: PresetRecord[]): Promise<void>;
}

const STORAGE_KEY = "reactimate.presets.v1";

class LocalStorageBackend implements PresetStorage {
  async list(): Promise<PresetRecord[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  async save(
    input: Omit<PresetRecord, "id" | "createdAt">,
  ): Promise<PresetRecord> {
    const existing = await this.list();
    const record: PresetRecord = {
      ...input,
      id: `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, record]));
    return record;
  }
  async delete(id: string): Promise<void> {
    const existing = await this.list();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(existing.filter((r) => r.id !== id)),
    );
  }
  async bulkPut(records: PresetRecord[]): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
}

const backend: PresetStorage = new LocalStorageBackend();

export interface PresetState {
  presets: PresetRecord[];
  loading: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
  save: (
    name: string,
    effectType: EffectType,
    config: PresetConfig,
  ) => Promise<PresetRecord>;
  remove: (id: string) => Promise<void>;
  importPreset: (json: string) => Promise<PresetRecord | null>;
  exportPreset: (id: string) => string | null;
}

export const usePresetStore = create<PresetState>((set, get) => ({
  presets: [],
  loading: false,
  loaded: false,
  refresh: async () => {
    set({ loading: true });
    const presets = await backend.list();
    set({ presets, loading: false, loaded: true });
  },
  save: async (name, effectType, config) => {
    const record = await backend.save({ name, effectType, config });
    set({ presets: [...get().presets, record] });
    return record;
  },
  remove: async (id) => {
    await backend.delete(id);
    set({ presets: get().presets.filter((r) => r.id !== id) });
  },
  importPreset: async (json) => {
    try {
      const parsed = JSON.parse(json) as PresetRecord;
      // Treat imported records as new ones — they get fresh ids.
      const record = await backend.save({
        name: parsed.name ?? "Imported preset",
        effectType: parsed.effectType,
        config: parsed.config,
      });
      set({ presets: [...get().presets, record] });
      return record;
    } catch {
      return null;
    }
  },
  exportPreset: (id) => {
    const p = get().presets.find((r) => r.id === id);
    return p ? JSON.stringify(p, null, 2) : null;
  },
}));
