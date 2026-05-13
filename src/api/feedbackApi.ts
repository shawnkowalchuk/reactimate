import { supabase } from "../auth/supabase";

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

export async function submitFeedback(input: {
  subject: string;
  body: string;
}): Promise<FeedbackRow | null> {
  if (!supabase) throw new Error("Supabase isn't configured.");
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sign in to submit feedback.");

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      user_id: userData.user.id,
      email: userData.user.email,
      subject: input.subject.trim(),
      body: input.body.trim(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FeedbackRow;
}

export async function listMyFeedback(): Promise<FeedbackWithCounts[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("feedback_with_counts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("listMyFeedback:", error.message);
    return [];
  }
  return (data ?? []) as FeedbackWithCounts[];
}

export async function listAllFeedback(): Promise<FeedbackWithCounts[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("feedback_with_counts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("listAllFeedback:", error.message);
    return [];
  }
  return (data ?? []) as FeedbackWithCounts[];
}

export async function getFeedback(id: string): Promise<FeedbackRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("getFeedback:", error.message);
    return null;
  }
  return data as FeedbackRow | null;
}

export async function listReplies(feedbackId: string): Promise<FeedbackReply[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("feedback_replies")
    .select("*")
    .eq("feedback_id", feedbackId)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("listReplies:", error.message);
    return [];
  }
  return (data ?? []) as FeedbackReply[];
}

export async function postReply(input: {
  feedbackId: string;
  body: string;
}): Promise<FeedbackReply | null> {
  if (!supabase) throw new Error("Supabase isn't configured.");
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sign in required.");

  const { data, error } = await supabase
    .from("feedback_replies")
    .insert({
      feedback_id: input.feedbackId,
      author_id: userData.user.id,
      body: input.body.trim(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Move feedback to "replied" so the admin list shows progress.
  await supabase
    .from("feedback")
    .update({ status: "replied", updated_at: new Date().toISOString() })
    .eq("id", input.feedbackId);

  return data as FeedbackReply;
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't configured.");
  const { error } = await supabase
    .from("feedback")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
