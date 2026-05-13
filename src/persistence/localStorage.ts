import type { Project } from "../types/project";

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
 * or null on any failure (missing keys, wrong types, etc.). We trust
 * the rest of our code only after this gate.
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

export function saveToStorage(project: Project): void {
  if (typeof window === "undefined") return;
  try {
    const payload: SavedState = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      project,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded, private browsing, etc. — silently skip.
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
