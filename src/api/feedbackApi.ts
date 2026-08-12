import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../auth/firebase";
import { tsToIso } from "./firestoreUtils";

export type FeedbackStatus = "open" | "replied" | "closed";

export interface FeedbackRow {
  id: string;
  user_id: string | null;
  email: string | null;
  subject: string;
  body: string;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
}

export interface FeedbackWithCounts extends FeedbackRow {
  reply_count: number;
  last_reply_at: string | null;
}

export interface FeedbackReply {
  id: string;
  feedback_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

// reply_count / last_reply_at are denormalized onto the feedback doc (the
// Postgres version computed them in a view) and maintained atomically in
// the same batch as each reply write.

function docToFeedback(
  id: string,
  data: Record<string, unknown>,
): FeedbackWithCounts {
  return {
    id,
    user_id: (data.user_id as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    subject: (data.subject as string) ?? "",
    body: (data.body as string) ?? "",
    status: (data.status as FeedbackStatus) ?? "open",
    created_at: tsToIso(data.created_at) ?? "",
    updated_at: tsToIso(data.updated_at) ?? "",
    reply_count: typeof data.reply_count === "number" ? data.reply_count : 0,
    last_reply_at: tsToIso(data.last_reply_at),
  };
}

export async function submitFeedback(input: {
  subject: string;
  body: string;
}): Promise<FeedbackRow | null> {
  if (!db) throw new Error("Cloud sync isn't configured.");
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in to submit feedback.");

  const payload = {
    user_id: user.uid,
    email: user.email,
    subject: input.subject.trim(),
    body: input.body.trim(),
    status: "open" as const,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    reply_count: 0,
    last_reply_at: null,
  };
  const ref = await addDoc(collection(db, "feedback"), payload);
  const now = new Date().toISOString();
  return {
    id: ref.id,
    user_id: user.uid,
    email: user.email,
    subject: payload.subject,
    body: payload.body,
    status: "open",
    created_at: now,
    updated_at: now,
  };
}

export async function listMyFeedback(): Promise<FeedbackWithCounts[]> {
  if (!db) return [];
  const uid = auth?.currentUser?.uid;
  if (!uid) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, "feedback"),
        where("user_id", "==", uid),
        orderBy("created_at", "desc"),
      ),
    );
    return snap.docs.map((d) => docToFeedback(d.id, d.data()));
  } catch (err) {
    console.warn("listMyFeedback:", err);
    return [];
  }
}

export async function listAllFeedback(): Promise<FeedbackWithCounts[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(collection(db, "feedback"), orderBy("created_at", "desc")),
    );
    return snap.docs.map((d) => docToFeedback(d.id, d.data()));
  } catch (err) {
    console.warn("listAllFeedback:", err);
    return [];
  }
}

export async function getFeedback(id: string): Promise<FeedbackRow | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "feedback", id));
    if (!snap.exists()) return null;
    return docToFeedback(snap.id, snap.data());
  } catch (err) {
    console.warn("getFeedback:", err);
    return null;
  }
}

export async function listReplies(feedbackId: string): Promise<FeedbackReply[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, "feedback", feedbackId, "replies"),
        orderBy("created_at", "asc"),
      ),
    );
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        feedback_id: feedbackId,
        author_id: (data.author_id as string) ?? "",
        body: (data.body as string) ?? "",
        created_at: tsToIso(data.created_at) ?? "",
      };
    });
  } catch (err) {
    console.warn("listReplies:", err);
    return [];
  }
}

export async function postReply(input: {
  feedbackId: string;
  body: string;
}): Promise<FeedbackReply | null> {
  if (!db) throw new Error("Cloud sync isn't configured.");
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in required.");

  const feedbackRef = doc(db, "feedback", input.feedbackId);
  const replyRef = doc(collection(db, "feedback", input.feedbackId, "replies"));
  const body = input.body.trim();

  // One atomic batch: the reply plus the parent's status and denormalized
  // reply metadata can't drift apart (the Postgres version wrote these in
  // two independent statements).
  const batch = writeBatch(db);
  batch.set(replyRef, {
    author_id: user.uid,
    body,
    created_at: serverTimestamp(),
  });
  batch.update(feedbackRef, {
    status: "replied",
    updated_at: serverTimestamp(),
    reply_count: increment(1),
    last_reply_at: serverTimestamp(),
  });
  await batch.commit();

  return {
    id: replyRef.id,
    feedback_id: input.feedbackId,
    author_id: user.uid,
    body,
    created_at: new Date().toISOString(),
  };
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
): Promise<void> {
  if (!db) throw new Error("Cloud sync isn't configured.");
  await updateDoc(doc(db, "feedback", id), {
    status,
    updated_at: serverTimestamp(),
  });
}
