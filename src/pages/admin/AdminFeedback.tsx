import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  listAllFeedback,
  type FeedbackStatus,
  type FeedbackWithCounts,
} from "../../api/feedbackApi";

const STATUSES: ("all" | FeedbackStatus)[] = ["all", "open", "replied", "closed"];

export function AdminFeedback() {
  const [rows, setRows] = useState<FeedbackWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");

  useEffect(() => {
    document.title = "Admin · Feedback · reactimate";
    (async () => {
      const data = await listAllFeedback();
      setRows(data);
      setLoading(false);
    })();
  }, []);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every user submission. Click a row to reply.
      </p>

      <div className="mt-6 flex items-center gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
              filter === s
                ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
            }`}
          >
            {s}
          </button>
        ))}
        <span className="ml-auto text-xs text-neutral-500">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">Nothing to show.</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          {filtered.map((f) => (
            <li key={f.id}>
              <Link
                to={`/admin/feedback/${f.id}`}
                className="block px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="truncate text-sm font-medium">{f.subject}</h3>
                  <StatusPill status={f.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {f.email ?? "anonymous"} ·{" "}
                  {new Date(f.created_at).toLocaleString()}
                  {f.reply_count > 0
                    ? ` · ${f.reply_count} repl${f.reply_count === 1 ? "y" : "ies"}`
                    : ""}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-neutral-600 dark:text-neutral-400">
                  {f.body}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}

function StatusPill({ status }: { status: FeedbackStatus }) {
  const map = {
    open: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    replied:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    closed:
      "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${map[status]}`}
    >
      {status}
    </span>
  );
}
