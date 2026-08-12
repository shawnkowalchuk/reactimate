import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  FileText,
  Loader2,
  MessageSquare,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { listAllProfiles } from "../../api/profileApi";
import { listAllFeedback } from "../../api/feedbackApi";
import { listAllProjectsAdmin } from "../../api/projectApi";
import { computeDashboardStats, type DashboardStats } from "./computeStats";
import { EFFECT_LABELS } from "../../constants/effects";
import type { EffectType } from "../../types/project";

export function AdminDashboard() {
  useEffect(() => {
    document.title = "Admin · Dashboard · reactimate";
  }, []);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [profiles, projects, feedback] = await Promise.all([
        listAllProfiles(),
        listAllProjectsAdmin(),
        listAllFeedback(),
      ]);
      if (cancelled) return;
      setStats(computeDashboardStats(profiles, projects, feedback));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Live numbers pulled from your Firebase project.
      </p>

      {loading || !stats ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Top-line counts */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Total users"
              value={stats.totalUsers}
              sub={`+${stats.signupsLast7d} in 7d · +${stats.signupsLast30d} in 30d`}
            />
            <StatCard
              icon={Activity}
              label="Active users"
              value={stats.activeUsers7d}
              sub={`7d window · ${stats.activeUsers30d} in 30d`}
            />
            <StatCard
              icon={FileText}
              label="Cloud projects"
              value={stats.totalProjects}
              sub={`${stats.activeEditors7d} edited in 7d`}
            />
            <StatCard
              icon={Sparkles}
              label="Avg effects / project"
              value={Math.round(stats.avgEffectsPerProject * 10) / 10}
              sub={
                stats.topEffectTypes[0]
                  ? `top: ${EFFECT_LABELS[stats.topEffectTypes[0].type]}`
                  : "no data"
              }
            />
          </div>

          {/* Signups trend */}
          <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <UserPlus size={14} className="text-sky-500" />
                Signups — last 30 days
              </h2>
              <span className="text-[11px] text-neutral-500 tabular-nums">
                {stats.signupsLast30d} total · peak {Math.max(...stats.signupTrend)}/day
              </span>
            </header>
            <Sparkline values={stats.signupTrend} />
          </section>

          {/* Effect usage + feedback breakdown side by side */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Sparkles size={14} className="text-sky-500" />
                Top effect types
              </h2>
              {stats.topEffectTypes.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  No effects in any cloud project yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {stats.topEffectTypes.map(({ type, count }) => (
                    <EffectBar
                      key={type}
                      type={type}
                      count={count}
                      max={stats.topEffectTypes[0].count}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <header className="mb-3 flex items-baseline justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <MessageSquare size={14} className="text-sky-500" />
                  Feedback
                </h2>
                <Link
                  to="/admin/feedback"
                  className="text-xs text-sky-600 hover:underline dark:text-sky-400"
                >
                  View all →
                </Link>
              </header>
              <div className="grid grid-cols-3 gap-3 text-center">
                <MiniStat
                  label="Open"
                  value={stats.feedbackOpen}
                  accent={stats.feedbackOpen > 0 ? "amber" : "neutral"}
                />
                <MiniStat label="Replied" value={stats.feedbackReplied} />
                <MiniStat label="Closed" value={stats.feedbackClosed} />
              </div>
              <p className="mt-3 text-[11px] text-neutral-500">
                {stats.totalFeedback} total submissions.
              </p>
            </section>
          </div>

          {/* Recent feedback list */}
          <section className="mt-8">
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
                        {f.reply_count > 0
                          ? ` · ${f.reply_count} repl${f.reply_count === 1 ? "y" : "ies"}`
                          : ""}
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
  sub?: string;
  accent?: "neutral" | "amber";
}

function StatCard({ icon: Icon, label, value, sub, accent = "neutral" }: StatCardProps) {
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
      {sub && (
        <div className="mt-1 text-[11px] text-neutral-500 tabular-nums">{sub}</div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: number;
  accent?: "neutral" | "amber";
}) {
  const valueClass =
    accent === "amber"
      ? "text-amber-600 dark:text-amber-400"
      : "text-neutral-900 dark:text-neutral-100";
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className={`text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
    </div>
  );
}

function EffectBar({
  type,
  count,
  max,
}: {
  type: EffectType;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 truncate text-neutral-700 dark:text-neutral-300">
        {EFFECT_LABELS[type]}
      </span>
      <div className="relative h-4 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
        <div
          className="h-full bg-sky-500/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-neutral-500">
        {count}
      </span>
    </li>
  );
}

/**
 * Inline SVG sparkline — no charting library. Renders as a filled area
 * + line so even short flat trends are visible. viewBox is fixed; CSS
 * scales to container width.
 */
function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const w = 600;
  const h = 80;
  const pad = 4;
  const max = Math.max(1, ...values); // avoid divide-by-zero
  const step = (w - pad * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    return [x, y] as const;
  });
  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${(pad + (values.length - 1) * step).toFixed(1)} ${h - pad} L ${pad.toFixed(1)} ${h - pad} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-20 w-full"
      aria-label="Signups per day for the last 30 days"
    >
      <path d={areaPath} className="fill-sky-500/15" />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-sky-500"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* End dot for the latest value */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1][0]}
          cy={points[points.length - 1][1]}
          r={2.5}
          className="fill-sky-500"
        />
      )}
    </svg>
  );
}
