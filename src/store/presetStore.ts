import { create } from "zustand";
import type { Effect, EffectType } from "../types/project";
import { supabase } from "../auth/supabase";

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
  | "particle"
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
 * Storage abstraction. The frontend has two implementations:
 *  - `LocalStorageBackend` — keeps presets in browser localStorage.
 *    Always available; used when Supabase isn't configured OR the user
 *    isn't signed in (so presets still work offline).
 *  - `SupabaseBackend` — persists to `public.presets` with RLS so the
 *    presets follow the user across devices.
 *
 * `activeBackend()` returns the right one based on auth state. The store
 * subscribes to Supabase auth changes and refreshes on sign-in / sign-out.
 */
export interface PresetStorage {
  list(): Promise<PresetRecord[]>;
  save(input: Omit<PresetRecord, "id" | "createdAt">): Promise<PresetRecord>;
  delete(id: string): Promise<void>;
  /** Replace all stored presets (used by Import). */
  bulkPut(records: PresetRecord[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// LocalStorageBackend
// ---------------------------------------------------------------------------

const STORAGE_KEY = "reactimate.presets.v1";

function migratePresets(records: PresetRecord[]): PresetRecord[] {
  return JSON.parse(
    JSON.stringify(records).replaceAll('"sparkle"', '"particle"'),
  );
}

class LocalStorageBackend implements PresetStorage {
  async list(): Promise<PresetRecord[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const records = Array.isArray(parsed) ? parsed : [];
      return migratePresets(records);
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

// ---------------------------------------------------------------------------
// SupabaseBackend
// ---------------------------------------------------------------------------

interface PresetRow {
  id: string;
  user_id: string;
  name: string;
  effect_type: string;
  config: PresetConfig;
  created_at: string;
}

const rowToRecord = (row: PresetRow): PresetRecord => ({
  id: row.id,
  name: row.name,
  effectType: row.effect_type as EffectType,
  config: row.config,
  createdAt: new Date(row.created_at).getTime(),
});

class SupabaseBackend implements PresetStorage {
  async list(): Promise<PresetRecord[]> {
    if (!supabase) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("presets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("presets list:", error.message);
      return [];
    }
    return ((data ?? []) as PresetRow[]).map(rowToRecord);
  }

  async save(
    input: Omit<PresetRecord, "id" | "createdAt">,
  ): Promise<PresetRecord> {
    if (!supabase) throw new Error("Supabase isn't configured.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sign in to save to the cloud.");
    const { data, error } = await supabase
      .from("presets")
      .insert({
        user_id: user.id,
        name: input.name,
        effect_type: input.effectType,
        config: input.config,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToRecord(data as PresetRow);
  }

  async delete(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from("presets").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async bulkPut(records: PresetRecord[]): Promise<void> {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sign in to save to the cloud.");
    await supabase.from("presets").delete().eq("user_id", user.id);
    if (records.length === 0) return;
    const rows = records.map((r) => ({
      user_id: user.id,
      name: r.name,
      effect_type: r.effectType,
      config: r.config,
    }));
    const { error } = await supabase.from("presets").insert(rows);
    if (error) throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Active-backend resolver
// ---------------------------------------------------------------------------

const localBackend = new LocalStorageBackend();
const cloudBackend = new SupabaseBackend();

/** True iff Supabase is configured AND the user is signed in. */
let signedIn = false;

function activeBackend(): PresetStorage {
  return supabase && signedIn ? cloudBackend : localBackend;
}

export function isPresetCloudActive(): boolean {
  return Boolean(supabase) && signedIn;
}

// ---------------------------------------------------------------------------
// One-time migration on first sign-in: copy local presets to the cloud
// only if the user's cloud bucket is empty (so we don't duplicate across
// devices).
// ---------------------------------------------------------------------------

let migrationDone = false;

async function migrateLocalToCloudOnce(): Promise<void> {
  if (migrationDone || !supabase || !signedIn) return;
  migrationDone = true;
  try {
    const cloud = await cloudBackend.list();
    if (cloud.length > 0) return; // user already has cloud presets — don't merge
    const local = await localBackend.list();
    if (local.length === 0) return;
    for (const r of local) {
      try {
        await cloudBackend.save({
          name: r.name,
          effectType: r.effectType,
          config: r.config,
        });
      } catch {
        // ignore individual failures; keep going
      }
    }
  } catch {
    // ignore — store.refresh() will retry on next sign-in
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface PresetState {
  presets: PresetRecord[];
  loading: boolean;
  loaded: boolean;
  isCloud: boolean;
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
  isCloud: false,
  refresh: async () => {
    set({ loading: true });
    const presets = await activeBackend().list();
    set({
      presets,
      loading: false,
      loaded: true,
      isCloud: isPresetCloudActive(),
    });
  },
  save: async (name, effectType, config) => {
    const record = await activeBackend().save({ name, effectType, config });
    set({ presets: [...get().presets, record] });
    return record;
  },
  remove: async (id) => {
    await activeBackend().delete(id);
    set({ presets: get().presets.filter((r) => r.id !== id) });
  },
  importPreset: async (json) => {
    try {
      const parsed = JSON.parse(json) as PresetRecord;
      const record = await activeBackend().save({
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

// ---------------------------------------------------------------------------
// Wire auth state changes → refresh + migrate
// ---------------------------------------------------------------------------

if (supabase) {
  // Initial session lookup
  void supabase.auth.getSession().then(async ({ data }) => {
    signedIn = Boolean(data.session);
    if (signedIn) await migrateLocalToCloudOnce();
    void usePresetStore.getState().refresh();
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    const wasSignedIn = signedIn;
    signedIn = Boolean(session);
    // Reset the per-session migration guard so a fresh sign-in on a new
    // browser triggers migration if the cloud is still empty.
    if (!wasSignedIn && signedIn) migrationDone = false;
    if (signedIn) {
      void migrateLocalToCloudOnce().finally(() => {
        void usePresetStore.getState().refresh();
      });
    } else {
      void usePresetStore.getState().refresh();
    }
  });
}
