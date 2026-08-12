import { FirebaseError } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db, isAuthEnabled } from "../auth/firebase";
import { tsToIso } from "./firestoreUtils";
import type { Project } from "../types/project";

// The project JSON is stored as a serialized string rather than a nested
// map: Firestore rejects directly-nested arrays (arrays of arrays), which
// effect configs can legitimately contain, and the blob is never queried
// server-side. Doc id == uid keeps the one-project-per-user invariant.

export async function saveProjectToDB(project: Project): Promise<boolean> {
  if (!db || !isAuthEnabled) return false;
  const uid = auth?.currentUser?.uid;
  if (!uid) return false;

  const ref = doc(db, "projects", uid);
  const payload = {
    user_id: uid,
    name: project.name,
    data: JSON.stringify(project),
    updated_at: serverTimestamp(),
  };
  try {
    await updateDoc(ref, payload);
    return true;
  } catch (err) {
    if (err instanceof FirebaseError && err.code === "not-found") {
      try {
        await setDoc(ref, { ...payload, created_at: serverTimestamp() });
        return true;
      } catch (createErr) {
        console.warn("saveProjectToDB:", createErr);
        return false;
      }
    }
    console.warn("saveProjectToDB:", err);
    return false;
  }
}

function parseProjectData(data: unknown): Project | null {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data) as Project;
  } catch {
    return null;
  }
}

export interface CloudProject {
  project: Project;
  /** ISO time of the last cloud write, or null if unknown. */
  updatedAt: string | null;
}

/** Load the caller's project plus its cloud `updated_at` for freshness comparisons. */
export async function loadProjectFromDBWithMeta(): Promise<CloudProject | null> {
  if (!db || !isAuthEnabled) return null;
  const uid = auth?.currentUser?.uid;
  if (!uid) return null;

  try {
    const snap = await getDoc(doc(db, "projects", uid));
    if (!snap.exists()) return null;
    const raw = snap.data();
    const project = parseProjectData(raw.data);
    if (!project) return null;
    return { project, updatedAt: tsToIso(raw.updated_at) };
  } catch (err) {
    console.warn("loadProjectFromDB:", err);
    return null;
  }
}

export async function loadProjectFromDB(): Promise<Project | null> {
  const cloud = await loadProjectFromDBWithMeta();
  return cloud?.project ?? null;
}

/**
 * Admin-only: list every cloud project with its full data. Security rules
 * allow this for any profile with is_admin = true; the server enforces it,
 * this client function just shapes the result.
 *
 * Note: returns full project data per row. With ~hundreds of users that's
 * still small (each project is typically a few KB of JSON), but if the
 * user base grows past a few thousand, aggregate server-side instead.
 */
export interface AdminProjectRow {
  id: string;
  user_id: string;
  name: string;
  data: Project;
  created_at: string;
  updated_at: string;
}

export async function listAllProjectsAdmin(): Promise<AdminProjectRow[]> {
  if (!db || !isAuthEnabled) return [];
  try {
    const snap = await getDocs(
      query(collection(db, "projects"), orderBy("updated_at", "desc")),
    );
    const rows: AdminProjectRow[] = [];
    for (const d of snap.docs) {
      const raw = d.data();
      const project = parseProjectData(raw.data);
      if (!project) continue;
      rows.push({
        id: d.id,
        user_id: (raw.user_id as string) ?? d.id,
        name: (raw.name as string) ?? "",
        data: project,
        created_at: tsToIso(raw.created_at) ?? "",
        updated_at: tsToIso(raw.updated_at) ?? "",
      });
    }
    return rows;
  } catch (err) {
    console.warn("listAllProjectsAdmin:", err);
    return [];
  }
}
