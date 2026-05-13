import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MessageSquare, UserPlus, Users } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { listAllProfiles, type Profile } from "../../api/profileApi";
import {
  listAllFeedback,
  type FeedbackWithCounts,
} from "../../api/feedbackApi";

interface Stats {
  totalUsers: number;
  signupsLast7d: number;
  totalFeedback: number;
  openFeedback: number;
  recentFeedback: FeedbackWithCounts[];
  loading: boolean;
}

export function AdminDashboard() {
  useEffect(() => {
    document.title = "Admin · Dashboard · reactimate";
  }, []);

  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    signupsLast7d: 0,
    totalFeedback: 0,
    openFeedback: 0,
    recentFeedback: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [profiles, feedback] = await Promise.all([
        listAllProfiles(),
        listAllFeedback(),
      ]);
      if (cancelled) return;
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recent = (profiles as Profile[]).filter(
        (p) => new Date(p.created_at).getTime() >= cutoff,
      ).length;
      const open = feedback.filter((f) => f.status === "open").length;
      setStats({
        totalUsers: profiles.length,
        signupsLast7d: recent,
        totalFeedback: feedback.length,
        openFeedback: open,
        recentFeedback: feedback.slice(0, 10),
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Live numbers pulled from your Supabase project.
      </p>

      {stats.loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Total users" value={stats.totalUsers} />
            <StatCard
              icon={UserPlus}
              label="Signups (7d)"
              value={stats.signupsLast7d}
            />
            <StatCard
              icon={MessageSquare}
              label="Feedback total"
              value={stats.totalFeedback}
            />
            <StatCard
              icon={MessageSquare}
              label="Feedback open"
              value={stats.openFeedback}
              accent={stats.openFeedback > 0 ? "amber" : "neutral"}
            />
          </div>

          <section className="mt-10">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold tracking-tight">
                Recent feedback
              </h2>
              <Link
                to="/admin/feedback"
                className="text-xs text-sky-600 hover:underline dark:text-sky-400"
              >
                View all →
              </Link>
            </div>
            {stats.recentFeedback.length === 0 ? (
              <p className="text-sm text-neutral-500">No feedback yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
                {stats.recentFeedback.map((f) => (
                  <li key={f.id}>
                    <Link
                      to={`/admin/feedback/${f.id}`}
                      className="block px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="truncate text-sm font-medium">
                          {f.subject}
                        </h3>
                        <time className="shrink-0 text-[11px] text-neutral-500">
                          {new Date(f.created_at).toLocaleString()}
                        </time>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {f.email ?? "anonymous"} · {f.status}
                        {f.reply_count > 0 ? ` · ${f.reply_count} repl${f.reply_count === 1 ? "y" : "ies"}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  accent?: "neutral" | "amber";
}

function StatCard({ icon: Icon, label, value, accent = "neutral" }: StatCardProps) {
  const valueClass =
    accent === "amber"
      ? "text-amber-600 dark:text-amber-400"
      : "text-neutral-900 dark:text-neutral-100";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <Icon className="text-sky-500" size={18} />
      <div className="mt-2 text-[11px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
