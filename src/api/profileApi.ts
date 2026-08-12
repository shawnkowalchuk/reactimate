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
import { auth, db } from "../auth/firebase";
import { tsToIso } from "./firestoreUtils";

export interface Profile {
  id: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  last_seen_at: string | null;
}

function docToProfile(id: string, data: Record<string, unknown>): Profile {
  return {
    id,
    email: (data.email as string | null) ?? null,
    is_admin: data.is_admin === true,
    created_at: tsToIso(data.created_at) ?? "",
    last_seen_at: tsToIso(data.last_seen_at),
  };
}

/**
 * One in-flight/settled ensure per uid per page load. Caching the PROMISE
 * (not a done flag) lets concurrent callers — e.g. the admin store's
 * refresh racing useAuth's listener on a brand-new account — await the
 * same create instead of reading before the doc exists.
 */
let ensured: { uid: string; promise: Promise<void> } | null = null;

/**
 * Create the caller's profile doc on first sign-in (replaces the Postgres
 * `handle_new_user()` trigger) and refresh `last_seen_at` on every session.
 * Security rules only allow `last_seen_at` to change on update, and force
 * `is_admin: false` on create — admin is granted by editing the doc in the
 * Firebase console.
 */
export function ensureMyProfile(
  uid: string,
  email: string | null,
): Promise<void> {
  if (!db) return Promise.resolve();
  if (ensured?.uid === uid) return ensured.promise;

  const ref = doc(db, "profiles", uid);
  const promise = (async () => {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { last_seen_at: serverTimestamp() });
    } else {
      await setDoc(ref, {
        email,
        is_admin: false,
        created_at: serverTimestamp(),
        last_seen_at: serverTimestamp(),
      });
    }
  })().catch((err) => {
    // Best effort — a StrictMode double-invoke or offline start shouldn't
    // break sign-in. Cleared so the next call retries.
    ensured = null;
    console.warn("ensureMyProfile:", err);
  });

  ensured = { uid, promise };
  return promise;
}

export async function fetchMyProfile(): Promise<Profile | null> {
  if (!db || !auth?.currentUser) return null;
  const uid = auth.currentUser.uid;
  try {
    const snap = await getDoc(doc(db, "profiles", uid));
    if (!snap.exists()) return null;
    return docToProfile(snap.id, snap.data());
  } catch (err) {
    console.warn("fetchMyProfile:", err);
    return null;
  }
}

export async function listAllProfiles(): Promise<Profile[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(collection(db, "profiles"), orderBy("created_at", "desc")),
    );
    return snap.docs.map((d) => docToProfile(d.id, d.data()));
  } catch (err) {
    console.warn("listAllProfiles:", err);
    return [];
  }
}
