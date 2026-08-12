import { useCallback, useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { isAuthEnabled } from "../auth/firebase";
import { useAuth } from "../auth/useAuth";
import { Navbar } from "../components/home/Navbar";
import { Footer } from "../components/home/Footer";
import { SignInScreen } from "../auth/SignInScreen";
import {
  listMyFeedback,
  listReplies,
  submitFeedback,
  type FeedbackReply,
  type FeedbackWithCounts,
} from "../api/feedbackApi";

export function FeedbackPage() {
  useEffect(() => {
    document.title = "Feedback · reactimate";
  }, []);

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Feedback</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Have an idea, a bug report, or just want to say hi? Drop a note. Replies appear here once an admin responds.
        </p>
        <Body />
      </main>
      <Footer />
    </div>
  );
}

function Body() {
  if (!isAuthEnabled) return <NotConfigured />;
  return <SignedInOrPrompt />;
}

function NotConfigured() {
  return (
    <div className="mt-8 rounded-lg border border-amber-300/60 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      <p>
        In-app feedback requires Firebase. For now, please open an issue at{" "}
        <a
          href="https://github.com/shawnkowalchuk/reactimate/issues"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          github.com/shawnkowalchuk/reactimate/issues
        </a>
        .
      </p>
    </div>
  );
}

function SignedInOrPrompt() {
  const { isLoading, user } = useAuth();
  if (isLoading) {
    return (
      <div className="mt-8 flex items-center gap-2 text-neutral-500">
        <Loader2 size={14} className="animate-spin" />
        Loading…
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mt-8">
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          Sign in to send feedback (so we can reply).
        </p>
        <SignInScreen />
      </div>
    );
  }
  return <FeedbackContent />;
}

function FeedbackContent() {
  const [threads, setThreads] = useState<FeedbackWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await listMyFeedback();
    setThreads(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mt-8 space-y-10">
      <SubmitForm onSubmitted={refresh} />
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Your previous feedback
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : threads.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing yet. Send your first message above.
          </p>
        ) : (
          <ul className="space-y-3">
            {threads.map((t) => (
              <Thread key={t.id} thread={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SubmitForm({ onSubmitted }: { onSubmitted: () => Promise<void> }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await submitFeedback({ subject, body });
      setSubject("");
      setBody("");
      setMessage({ kind: "ok", text: "Thanks — we've got it." });
      await onSubmitted();
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Couldn't send.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold tracking-tight">New feedback</h2>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
          Subject
        </span>
        <input
          type="text"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Something useful, in a few words"
          className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
          Message
        </span>
        <textarea
          required
          rows={5}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      {message && (
        <p
          className={`text-xs ${
            message.kind === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {message.text}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !subject.trim() || !body.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Send
        </button>
      </div>
    </form>
  );
}

function Thread({ thread }: { thread: FeedbackWithCounts }) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && replies.length === 0) {
      setLoadingReplies(true);
      const data = await listReplies(thread.id);
      setReplies(data);
      setLoadingReplies(false);
    }
  };

  const created = new Date(thread.created_at).toLocaleString();

  return (
    <li className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <StatusPill status={thread.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-sm font-semibold">{thread.subject}</h3>
            <time className="shrink-0 text-[11px] text-neutral-500">{created}</time>
          </div>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {thread.reply_count > 0
              ? `${thread.reply_count} repl${thread.reply_count === 1 ? "y" : "ies"}`
              : "No replies yet"}
          </p>
        </div>
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
          <article className="whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
            {thread.body}
          </article>
          {loadingReplies && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 size={12} className="animate-spin" /> Loading replies…
            </div>
          )}
          {replies.map((r) => (
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
              <p className="whitespace-pre-wrap text-neutral-800 dark:text-neutral-100">{r.body}</p>
            </article>
          ))}
        </div>
      )}
    </li>
  );
}

function StatusPill({ status }: { status: "open" | "replied" | "closed" }) {
  const map = {
    open: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    replied: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    closed: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  } as const;
  return (
    <span
      className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${map[status]}`}
    >
      {status}
    </span>
  );
}
