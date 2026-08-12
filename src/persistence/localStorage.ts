import type { Project } from "../types/project";
import { isAuthEnabled } from "../auth/firebase";
import { saveProjectToDB, loadProjectFromDBWithMeta } from "../api/projectApi";
import { isShadowProject } from "./shadowFlag";

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
 * Translate the old particle/fireworks `mode: "component" | "around"` schema
 * into the new bbox-based `mode: "area"` + `area` rectangle. Old projects
 * had no explicit area — they tracked the text bbox at render-time.
 * Without DOM access at load-time we substitute a sensible default
 * rectangle centered on the project canvas (with extra padding for
 * "around"/`spreadRadius` to roughly preserve the visual extent).
 */
function migrateAreaSchema(project: Project): Project {
  const cw = project.canvas?.width ?? 1200;
  const ch = project.canvas?.height ?? 675;
  const defaultArea = (padding = 0) => {
    const w = Math.min(cw - 80, 480 + padding * 2);
    const h = Math.min(ch - 80, 240 + padding * 2);
    return {
      x: Math.round((cw - w) / 2),
      y: Math.round((ch - h) / 2),
      width: w,
      height: h,
    };
  };
  for (const c of project.layer?.components ?? []) {
    for (const e of c.effects ?? []) {
      const p = (e as { particle?: Record<string, unknown> }).particle;
      if (p && (p.mode === "component" || p.mode === "around")) {
        const padding = p.mode === "around" ? Number(p.rangePx ?? 20) : 0;
        p.mode = "area";
        if (!p.area) p.area = defaultArea(padding);
        delete p.rangePx;
      }
      const fw = (e as { fireworks?: Record<string, unknown> }).fireworks;
      if (fw && !fw.area) {
        const padding = Number(fw.spreadRadius ?? 0);
        fw.area = defaultArea(padding);
        delete fw.mode;
        delete fw.spreadRadius;
        delete fw.rocketsSpread;
      }
    }
  }
  return project;
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
  return migrateAreaSchema(p as Project);
}

/** Load + validate the raw saved state, keeping its savedAt stamp. */
function loadSavedState(): { project: Project; savedAt: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const state = parsed as Partial<SavedState>;
    if (state.schemaVersion !== SCHEMA_VERSION) return null;
    const migrated = migrateSparkleToParticle(state.project) as Project;
    const project = validateProject(migrated);
    if (!project) return null;
    return { project, savedAt: state.savedAt ?? null };
  } catch {
    return null;
  }
}

/** Always loads from localStorage (sync — instant on app start). */
export function loadFromStorage(): Project | null {
  return loadSavedState()?.project ?? null;
}

// ---------------------------------------------------------------------------
// Cloud write throttle. localStorage keeps the 400ms autosave cadence, but
// Firestore bills per write and its free tier is 20K writes/day — so cloud
// pushes coalesce to at most one every CLOUD_SAVE_INTERVAL_MS, with a flush
// when the tab hides so the last edits still land.
// ---------------------------------------------------------------------------

const CLOUD_SAVE_INTERVAL_MS = 10_000;

let cloudTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCloudProject: Project | null = null;

function queueCloudSave(project: Project): void {
  pendingCloudProject = project;
  if (cloudTimer === null) {
    cloudTimer = setTimeout(flushCloudSave, CLOUD_SAVE_INTERVAL_MS);
  }
}

/** Push the pending cloud write immediately (no-op when nothing is queued). */
export function flushCloudSave(): void {
  if (cloudTimer !== null) {
    clearTimeout(cloudTimer);
    cloudTimer = null;
  }
  const project = pendingCloudProject;
  pendingCloudProject = null;
  if (project) {
    saveProjectToDB(project).catch(() => undefined);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushCloudSave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushCloudSave();
  });
}

/** Always saves to localStorage. Also queues an async DB save if auth is enabled. */
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
  // DB (async, throttled). Skipped while the project is shadowing
  // an example — otherwise the user's cloud project gets silently
  // clobbered the moment they open an example in the editor.
  if (isAuthEnabled && !isShadowProject()) {
    queueCloudSave(project);
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
 * Called once after auth is resolved. Picks whichever copy is newer:
 * the throttled cloud push means localStorage can be up to ~10s ahead of
 * the DB (e.g. the tab was killed before the flush), so when both sides
 * exist the fresher timestamp wins and the loser is overwritten. If only
 * one side has data, that side wins (and local gets migrated up).
 * Returns null if nothing is available.
 */
export async function loadFromCloudOrMigrate(): Promise<Project | null> {
  if (!isAuthEnabled) return null;
  let cloud = null;
  try {
    cloud = await loadProjectFromDBWithMeta();
  } catch {
    // DB unavailable — fall through to local.
  }
  const local = loadSavedState();

  if (cloud && local) {
    const cloudTime = cloud.updatedAt ? Date.parse(cloud.updatedAt) : 0;
    const localTime = local.savedAt ? Date.parse(local.savedAt) : 0;
    if (localTime > cloudTime) {
      saveProjectToDB(local.project).catch(() => undefined);
      return local.project;
    }
    return validateProject(cloud.project);
  }
  if (cloud) return validateProject(cloud.project);
  if (local) {
    saveProjectToDB(local.project).catch(() => undefined);
    return local.project;
  }
  return null;
}
