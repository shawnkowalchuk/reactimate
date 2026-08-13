import type { Profile } from "../../api/profileApi";
import type { AdminProjectRow } from "../../api/projectApi";
import type { FeedbackWithCounts } from "../../api/feedbackApi";
import type { EffectType, Project } from "../../types/project";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DashboardStats {
  // User stats
  totalUsers: number;
  signupsLast7d: number;
  signupsLast30d: number;
  activeUsers7d: number;
  activeUsers30d: number;
  /** Signups per day for the last 30 days, oldest first. Length: 30. */
  signupTrend: number[];

  // Time-in-app stats (profiles[].active_seconds, accumulated by useActiveTime)
  /** Total foreground, non-idle editor seconds across every user. */
  totalActiveSeconds: number;
  /**
   * Mean seconds among users who have ANY recorded time. Averaging over all
   * profiles would drag toward zero as signups grow, hiding whether the
   * people who do engage are engaging more.
   */
  avgActiveSecondsPerEngagedUser: number;
  /** Users with any recorded editor time. */
  engagedUsers: number;
  /** Highest single-user total, for the dashboard's "most active" line. */
  maxActiveSeconds: number;

  // Project stats
  totalProjects: number;
  activeEditors7d: number;
  avgEffectsPerProject: number;
  /** Top effect types by total usage across all cloud projects. */
  topEffectTypes: { type: EffectType; count: number }[];

  // Feedback stats
  totalFeedback: number;
  feedbackOpen: number;
  feedbackReplied: number;
  feedbackClosed: number;
  recentFeedback: FeedbackWithCounts[];
}

export function computeDashboardStats(
  profiles: Profile[],
  projects: AdminProjectRow[],
  feedback: FeedbackWithCounts[],
): DashboardStats {
  const now = Date.now();
  const cutoff7d = now - 7 * DAY_MS;
  const cutoff30d = now - 30 * DAY_MS;

  // ---- User stats ----------------------------------------------------------
  const signupsLast7d = countSince(profiles.map((p) => p.created_at), cutoff7d);
  const signupsLast30d = countSince(
    profiles.map((p) => p.created_at),
    cutoff30d,
  );
  const activeUsers7d = countSince(
    profiles.flatMap((p) => (p.last_seen_at ? [p.last_seen_at] : [])),
    cutoff7d,
  );
  const activeUsers30d = countSince(
    profiles.flatMap((p) => (p.last_seen_at ? [p.last_seen_at] : [])),
    cutoff30d,
  );
  const signupTrend = bucketByDay(
    profiles.map((p) => p.created_at),
    30,
    now,
  );

  // ---- Time in app ---------------------------------------------------------
  const activeSeconds = profiles
    .map((p) => (Number.isFinite(p.active_seconds) ? p.active_seconds : 0))
    .filter((s) => s > 0);
  const totalActiveSeconds = activeSeconds.reduce((s, n) => s + n, 0);
  const engagedUsers = activeSeconds.length;
  const avgActiveSecondsPerEngagedUser =
    engagedUsers === 0 ? 0 : totalActiveSeconds / engagedUsers;
  const maxActiveSeconds = engagedUsers === 0 ? 0 : Math.max(...activeSeconds);

  // ---- Project stats -------------------------------------------------------
  const activeEditors7d = countSince(
    projects.map((p) => p.updated_at),
    cutoff7d,
  );
  const effectCounts = countEffectTypes(projects);
  const totalEffects = Object.values(effectCounts).reduce((s, n) => s + n, 0);
  const avgEffectsPerProject =
    projects.length === 0 ? 0 : totalEffects / projects.length;
  const topEffectTypes = (Object.entries(effectCounts) as [EffectType, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  // ---- Feedback stats ------------------------------------------------------
  const feedbackOpen = feedback.filter((f) => f.status === "open").length;
  const feedbackReplied = feedback.filter((f) => f.status === "replied").length;
  const feedbackClosed = feedback.filter((f) => f.status === "closed").length;

  return {
    totalUsers: profiles.length,
    signupsLast7d,
    signupsLast30d,
    activeUsers7d,
    activeUsers30d,
    signupTrend,

    totalActiveSeconds,
    avgActiveSecondsPerEngagedUser,
    engagedUsers,
    maxActiveSeconds,

    totalProjects: projects.length,
    activeEditors7d,
    avgEffectsPerProject,
    topEffectTypes,

    totalFeedback: feedback.length,
    feedbackOpen,
    feedbackReplied,
    feedbackClosed,
    recentFeedback: feedback.slice(0, 10),
  };
}

/** Number of ISO timestamps with parsed time >= cutoff. */
function countSince(timestamps: string[], cutoff: number): number {
  let n = 0;
  for (const t of timestamps) {
    const ts = new Date(t).getTime();
    if (Number.isFinite(ts) && ts >= cutoff) n++;
  }
  return n;
}

/**
 * Bucket ISO timestamps into `days` daily counts (oldest first).
 * Day boundaries are at local-midnight relative to `nowMs`.
 */
function bucketByDay(timestamps: string[], days: number, nowMs: number): number[] {
  const buckets = new Array<number>(days).fill(0);
  const today = startOfLocalDay(nowMs);
  for (const t of timestamps) {
    const ts = new Date(t).getTime();
    if (!Number.isFinite(ts)) continue;
    const dayDiff = Math.floor((today - startOfLocalDay(ts)) / DAY_MS);
    if (dayDiff < 0 || dayDiff >= days) continue;
    // dayDiff = 0 is today, dayDiff = days-1 is the oldest in the window.
    // We want oldest first → index = days - 1 - dayDiff.
    buckets[days - 1 - dayDiff]++;
  }
  return buckets;
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Walk every cloud project and count effect-type occurrences across all
 * components. Defensive against malformed JSONB (returns 0s rather than
 * throwing) since the admin dashboard shouldn't crash on bad rows.
 */
function countEffectTypes(projects: AdminProjectRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of projects) {
    const p = row.data as Partial<Project> | null;
    const components = p?.layer?.components;
    if (!Array.isArray(components)) continue;
    for (const c of components) {
      const effects = c?.effects;
      if (!Array.isArray(effects)) continue;
      for (const e of effects) {
        const t = e?.type;
        // Skip "custom" — it's the no-effect placeholder, would dominate
        // any signal we're trying to read about actual effect usage.
        if (typeof t !== "string" || t === "custom") continue;
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
  }
  return counts;
}
