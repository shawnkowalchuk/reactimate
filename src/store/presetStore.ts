import { create } from "zustand";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import type { Effect, EffectType } from "../types/project";
import { auth, db } from "../auth/firebase";

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
 *    Always available; used when Firebase isn't configured OR the user
 *    isn't signed in (so presets still work offline).
 *  - `FirestoreBackend` — persists to the `presets` collection (security
 *    rules scope rows to their owner) so presets follow the user across
 *    devices.
 *
 * `activeBackend()` returns the right one based on auth state. The store
 * subscribes to Firebase auth changes and refreshes on sign-in / sign-out.
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
// FirestoreBackend
// ---------------------------------------------------------------------------

// `config` is stored as a JSON string: Firestore rejects directly-nested
// arrays, which effect configs can contain, and it's never queried.
const docToRecord = (
  id: string,
  data: Record<string, unknown>,
): PresetRecord | null => {
  try {
    const created = data.created_at;
    return {
      id,
      name: (data.name as string) ?? "",
      effectType: data.effect_type as EffectType,
      config: JSON.parse(data.config as string) as PresetConfig,
      createdAt:
        created instanceof Timestamp ? created.toMillis() : Date.now(),
    };
  } catch {
    return null;
  }
};

class FirestoreBackend implements PresetStorage {
  async list(): Promise<PresetRecord[]> {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid) return [];
    try {
      const snap = await getDocs(
        query(
          collection(db, "presets"),
          where("user_id", "==", uid),
          orderBy("created_at", "asc"),
        ),
      );
      return snap.docs
        .map((d) => docToRecord(d.id, d.data()))
        .filter((r): r is PresetRecord => r !== null);
    } catch (err) {
      console.warn("presets list:", err);
      return [];
    }
  }

  async save(
    input: Omit<PresetRecord, "id" | "createdAt">,
  ): Promise<PresetRecord> {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid) throw new Error("Sign in to save to the cloud.");
    const ref = await addDoc(collection(db, "presets"), {
      user_id: uid,
      name: input.name,
      effect_type: input.effectType,
      config: JSON.stringify(input.config),
      created_at: serverTimestamp(),
    });
    return { ...input, id: ref.id, createdAt: Date.now() };
  }

  async delete(id: string): Promise<void> {
    if (!db) return;
    await deleteDoc(doc(db, "presets", id));
  }

  async bulkPut(records: PresetRecord[]): Promise<void> {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid) throw new Error("Sign in to save to the cloud.");
    // Single atomic batch — the old delete-then-insert could lose every
    // preset if the insert half failed.
    const existing = await getDocs(
      query(collection(db, "presets"), where("user_id", "==", uid)),
    );
    const batch = writeBatch(db);
    for (const d of existing.docs) batch.delete(d.ref);
    for (const r of records) {
      batch.set(doc(collection(db, "presets")), {
        user_id: uid,
        name: r.name,
        effect_type: r.effectType,
        config: JSON.stringify(r.config),
        created_at: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

// ---------------------------------------------------------------------------
// Active-backend resolver
// ---------------------------------------------------------------------------

const localBackend = new LocalStorageBackend();
const cloudBackend = new FirestoreBackend();

/** True iff Firebase is configured AND the user is signed in. */
let signedIn = false;

function activeBackend(): PresetStorage {
  return auth && signedIn ? cloudBackend : localBackend;
}

export function isPresetCloudActive(): boolean {
  return Boolean(auth) && signedIn;
}

// ---------------------------------------------------------------------------
// One-time migration on first sign-in: copy local presets to the cloud
// only if the user's cloud bucket is empty (so we don't duplicate across
// devices).
// ---------------------------------------------------------------------------

let migrationDone = false;

async function migrateLocalToCloudOnce(): Promise<void> {
  if (migrationDone || !auth || !signedIn) return;
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

if (auth) {
  // Fires immediately with the restored session, then on every sign-in /
  // sign-out — covers both the initial lookup and later changes.
  onAuthStateChanged(auth, (user) => {
    const wasSignedIn = signedIn;
    signedIn = Boolean(user);
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
