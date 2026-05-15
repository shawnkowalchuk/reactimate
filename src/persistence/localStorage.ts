import type { Project } from "../types/project";
import { isAuthEnabled } from "../auth/supabase";
import { saveProjectToDB, loadProjectFromDB } from "../api/projectApi";

const STORAGE_KEY = "reactimate.project.v1";
const SCHEMA_VERSION = 1;

interface SavedState {
  schemaVersion: number;
  savedAt: string;
  project: Project;
}

/**
 * Recursively walk an arbitrary JSON value and migrate any legacy
 * "sparkle" string/property references to "particle".
 */
function migrateSparkleToParticle(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value === "sparkle" ? "particle" : value;
  }
  if (Array.isArray(value)) {
    return value.map(migrateSparkleToParticle);
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const newKey = key === "sparkle" ? "particle" : key;
      next[newKey] = migrateSparkleToParticle(obj[key]);
    }
    return next;
  }
  return value;
}

/**
 * Validate a parsed value as a Project. Returns the project on success
 * or null on any failure (missing keys, wrong types, etc.).
 */
export function validateProject(value: unknown): Project | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<Project>;
  if (typeof p.id !== "string") return null;
  if (typeof p.name !== "string") return null;
  if (typeof p.duration !== "number" || !Number.isFinite(p.duration)) return null;
  if (!p.canvas || typeof p.canvas !== "object") return null;
  if (!p.defaultTextStyle || typeof p.defaultTextStyle !== "object") return null;
  if (!p.layer || typeof p.layer !== "object") return null;
  if (typeof p.layer.text !== "string") return null;
  if (!Array.isArray(p.layer.components)) return null;
  for (const c of p.layer.components) {
    if (!c || typeof c !== "object") return null;
    if (typeof c.id !== "string") return null;
    if (typeof c.startIndex !== "number" || typeof c.endIndex !== "number") return null;
    if (!c.style || typeof c.style !== "object") return null;
    if (!Array.isArray(c.effects)) return null;
  }
  return p as Project;
}

/** Always loads from localStorage (sync — instant on app start). */
export function loadFromStorage(): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const state = parsed as Partial<SavedState>;
    if (state.schemaVersion !== SCHEMA_VERSION) return null;
    const migrated = migrateSparkleToParticle(state.project) as Project;
    return validateProject(migrated);
  } catch {
    return null;
  }
}

/** Always saves to localStorage. Also fires an async DB save if auth is enabled. */
export function saveToStorage(project: Project): void {
  // LocalStorage (sync, always works).
  if (typeof window !== "undefined") {
    try {
      const payload: SavedState = {
        schemaVersion: SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        project,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota exceeded, private browsing, etc.
    }
  }
  // DB (async, fire-and-forget).
  if (isAuthEnabled) {
    saveProjectToDB(project).catch(() => undefined);
  }
}

export function clearStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Called once after auth is resolved. If the DB has a project, returns it.
 * If not but localStorage does, migrates localStorage → DB and returns that.
 * Returns null if nothing is available.
 */
export async function loadFromCloudOrMigrate(): Promise<Project | null> {
  if (!isAuthEnabled) return null;
  try {
    const dbProject = await loadProjectFromDB();
    if (dbProject) return validateProject(dbProject);
  } catch {
    // DB unavailable — fall through to migrate.
  }
  // No DB project — migrate localStorage if present.
  const local = loadFromStorage();
  if (local) {
    saveProjectToDB(local).catch(() => undefined);
    return local;
  }
  return null;
}
