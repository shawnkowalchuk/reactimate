import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  getFeedback,
  listReplies,
  postReply,
  updateFeedbackStatus,
  type FeedbackRow,
  type FeedbackReply,
  type FeedbackStatus,
} from "../../api/feedbackApi";
import { useAdminBadgeStore } from "../../store/adminBadgeStore";

export function AdminFeedbackDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const [thread, setThread] = useState<FeedbackRow | null>(null);
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Replying flips the thread to "replied" and closing removes it from the
  // open set — both change the nav badge, so re-count after each.
  const refreshBadge = useAdminBadgeStore((s) => s.refresh);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [t, r] = await Promise.all([getFeedback(id), listReplies(id)]);
    setThread(t);
    setReplies(r);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    document.title = "Admin · Reply · reactimate";
    void refresh();
  }, [refresh]);

  const onPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread || !reply.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      await postReply({ feedbackId: thread.id, body: reply });
      setReply("");
      await Promise.all([refresh(), refreshBadge()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post reply.");
    } finally {
      setPosting(false);
    }
  };

  const onStatus = async (next: FeedbackStatus) => {
    if (!thread) return;
    try {
      await updateFeedbackStatus(thread.id, next);
      await Promise.all([refresh(), refreshBadge()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update status.");
    }
  };

  return (
    <AdminLayout>
      <Link
        to="/admin/feedback"
        className="mb-4 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        <ArrowLeft size={12} />
        All feedback
      </Link>

      {loading || !thread ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <header className="flex items-baseline justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {thread.subject}
            </h1>
            <select
              value={thread.status}
              onChange={(e) => void onStatus(e.target.value as FeedbackStatus)}
              className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs capitalize dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="open">open</option>
              <option value="replied">replied</option>
              <option value="closed">closed</option>
            </select>
          </header>
          <p className="mt-1 text-xs text-neutral-500">
            from {thread.email ?? "anonymous"} ·{" "}
            {new Date(thread.created_at).toLocaleString()}
          </p>

          <article className="mt-6 whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
            {thread.body}
          </article>

          <section className="mt-6 space-y-3">
            {replies.length === 0 ? (
              <p className="text-xs text-neutral-500">No replies yet.</p>
            ) : (
              replies.map((r) => (
                <article
                  key={r.id}
                  className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-900/40 dark:bg-sky-950/40"
                >
                  <header className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-sky-700 dark:text-sky-300">
                    Admin reply
                    <time className="text-[11px] text-neutral-500">
                      {new Date(r.created_at).toLocaleString()}
                    </time>
                  </header>
                  <p className="whitespace-pre-wrap text-neutral-800 dark:text-neutral-100">
                    {r.body}
                  </p>
                </article>
              ))
            )}
          </section>

          <form onSubmit={onPost} className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
              Reply
            </h2>
            <textarea
              required
              rows={5}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write your reply…"
              className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
            />
            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                disabled={posting || !reply.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send reply
              </button>
            </div>
          </form>
        </>
      )}
    </AdminLayout>
  );
}
