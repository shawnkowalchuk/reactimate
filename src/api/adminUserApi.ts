import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type Query,
} from "firebase/firestore";
import { auth, db } from "../auth/firebase";
import type { Profile } from "./profileApi";

/**
 * Why this profile can't be removed, or `null` when removal is allowed.
 *
 * Pure so it can be unit-tested and reused by the UI (button disabled +
 * tooltip) and by `purgeUserData` (last-line refusal). The REAL guarantee
 * lives in `firestore.rules` — a client check is only a courtesy, since
 * anyone can call the SDK directly.
 */
export function removalBlockedReason(
  profile: Profile,
  currentUid: string | null,
): string | null {
  if (profile.is_admin) return "Admin accounts can't be removed.";
  if (currentUid !== null && profile.id === currentUid) {
    return "You can't remove your own account.";
  }
  return null;
}

export interface PurgeResult {
  presets: number;
  feedback: number;
  replies: number;
  projectDeleted: boolean;
  profileDeleted: boolean;
}

/** Firestore caps a write batch at 500 ops; stay under it with headroom. */
const BATCH_LIMIT = 400;

/** Delete every doc matched by `q`, chunked into batches. Returns the count. */
async function deleteAllMatching(q: Query): Promise<number> {
  if (!db) return 0;
  const snap = await getDocs(q);
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref);
    await batch.commit();
    deleted += Math.min(BATCH_LIMIT, snap.docs.length - i);
  }
  return deleted;
}

/**
 * Delete everything this user owns in Firestore: their project, presets,
 * feedback threads (and each thread's replies), then their profile.
 *
 * **Their Firebase Auth login is NOT deleted.** Removing an auth account
 * requires the Admin SDK, which is server-side only and needs the paid
 * Blaze plan for Cloud Functions. So this purges the user's data; if that
 * person signs in again, `ensureMyProfile` creates a fresh empty profile
 * and they're back with a blank account. To truly lock someone out, delete
 * their user in the Firebase console → Authentication.
 *
 * **Order matters.** The profile doc is deleted LAST because the rules
 * guard every other delete with `targetIsProtected(uid)`, which reads that
 * profile to check `is_admin`. Delete it first and every remaining delete
 * is denied, stranding the user's data.
 *
 * Not atomic: Firestore has no cross-collection transaction for a query
 * this open-ended. A failure part-way leaves the profile intact, so the row
 * stays in the admin list and the purge can simply be retried.
 */
export async function purgeUserData(
  uid: string,
  profile: Profile,
): Promise<PurgeResult> {
  if (!db) throw new Error("Cloud sync isn't configured.");
  const blocked = removalBlockedReason(profile, auth?.currentUser?.uid ?? null);
  if (blocked) throw new Error(blocked);

  // 1. Their single project doc (id == uid). Firestore treats deleting a
  //    missing doc as a silent success, so check first — otherwise the
  //    confirmation would claim a project was deleted for a user who never
  //    saved one to the cloud.
  const projectRef = doc(db, "projects", uid);
  const projectDeleted = (await getDoc(projectRef)).exists();
  if (projectDeleted) await deleteDoc(projectRef);

  // 2. Presets — a flat collection scoped by user_id.
  const presets = await deleteAllMatching(
    query(collection(db, "presets"), where("user_id", "==", uid)),
  );

  // 3. Feedback threads. Replies live in a subcollection, and deleting a
  //    parent doc does NOT cascade in Firestore — each thread's replies
  //    have to go first or they're orphaned and unreachable.
  const threads = await getDocs(
    query(collection(db, "feedback"), where("user_id", "==", uid)),
  );
  let replies = 0;
  for (const thread of threads.docs) {
    replies += await deleteAllMatching(collection(thread.ref, "replies"));
  }
  let feedback = 0;
  for (let i = 0; i < threads.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const t of threads.docs.slice(i, i + BATCH_LIMIT)) batch.delete(t.ref);
    await batch.commit();
    feedback += Math.min(BATCH_LIMIT, threads.docs.length - i);
  }

  // 4. Profile LAST — see the ordering note above.
  await deleteDoc(doc(db, "profiles", uid));

  return { presets, feedback, replies, projectDeleted, profileDeleted: true };
}
