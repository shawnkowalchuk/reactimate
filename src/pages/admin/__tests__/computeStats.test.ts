import { describe, it, expect } from "vitest";
import { computeDashboardStats } from "../computeStats";
import type { Profile } from "../../../api/profileApi";
import type { AdminProjectRow } from "../../../api/projectApi";
import type { FeedbackWithCounts } from "../../../api/feedbackApi";

const DAY_MS = 24 * 60 * 60 * 1000;

function profileAt(daysAgo: number, lastSeenDaysAgo?: number): Profile {
  const now = Date.now();
  return {
    id: `u-${Math.random()}`,
    email: "x@x.com",
    is_admin: false,
    created_at: new Date(now - daysAgo * DAY_MS).toISOString(),
    last_seen_at:
      lastSeenDaysAgo === undefined
        ? null
        : new Date(now - lastSeenDaysAgo * DAY_MS).toISOString(),
  };
}

function projectRow(
  updatedDaysAgo: number,
  effectTypes: string[] = [],
): AdminProjectRow {
  const now = Date.now();
  return {
    id: `p-${Math.random()}`,
    user_id: "u-x",
    name: "Untitled hero",
    created_at: new Date(now - updatedDaysAgo * DAY_MS).toISOString(),
    updated_at: new Date(now - updatedDaysAgo * DAY_MS).toISOString(),
    data: {
      layer: {
        components: [
          {
            effects: effectTypes.map((type) => ({ type })),
          },
        ],
      },
    } as unknown as AdminProjectRow["data"],
  };
}

function feedbackRow(status: "open" | "replied" | "closed"): FeedbackWithCounts {
  return {
    id: `f-${Math.random()}`,
    user_id: null,
    email: null,
    subject: "subj",
    body: "body",
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    reply_count: 0,
    last_reply_at: null,
  };
}

describe("computeDashboardStats", () => {
  it("totals and bucketed signups", () => {
    const profiles = [
      profileAt(0),
      profileAt(2),
      profileAt(6),
      profileAt(10),
      profileAt(40),
    ];
    const stats = computeDashboardStats(profiles, [], []);
    expect(stats.totalUsers).toBe(5);
    expect(stats.signupsLast7d).toBe(3); // 0, 2, 6 days ago
    expect(stats.signupsLast30d).toBe(4); // adds 10 days
    expect(stats.signupTrend).toHaveLength(30);
    expect(stats.signupTrend.reduce((s, n) => s + n, 0)).toBe(4);
    // Today (last bucket) should have the 0-day-ago signup
    expect(stats.signupTrend[29]).toBe(1);
  });

  it("counts active users from last_seen_at", () => {
    const profiles = [
      profileAt(20, 1), // active in 7d AND 30d
      profileAt(20, 6), // active in 7d AND 30d
      profileAt(20, 15), // active in 30d only
      profileAt(20), // never seen
    ];
    const stats = computeDashboardStats(profiles, [], []);
    expect(stats.activeUsers7d).toBe(2);
    expect(stats.activeUsers30d).toBe(3);
  });

  it("aggregates project stats and top effect types", () => {
    const projects = [
      projectRow(1, ["fade", "fade", "zoom"]),
      projectRow(2, ["fade", "spotlight"]),
      projectRow(10, ["fade"]), // outside 7d window
      projectRow(3, []), // no effects
    ];
    const stats = computeDashboardStats([], projects, []);
    expect(stats.totalProjects).toBe(4);
    expect(stats.activeEditors7d).toBe(3);
    // 6 total effects across 4 projects = 1.5 avg
    expect(stats.avgEffectsPerProject).toBeCloseTo(6 / 4, 4);
    expect(stats.topEffectTypes[0]).toEqual({ type: "fade", count: 4 });
    expect(stats.topEffectTypes[1]).toEqual({ type: "zoom", count: 1 });
    expect(stats.topEffectTypes[2]).toEqual({ type: "spotlight", count: 1 });
  });

  it("excludes 'custom' (no-effect placeholder) from top-effect ranking AND from the avg", () => {
    const projects = [
      projectRow(1, ["custom", "custom", "custom", "fade"]),
    ];
    const stats = computeDashboardStats([], projects, []);
    // 'custom' would have dominated the ranking; ignored.
    expect(stats.topEffectTypes).toEqual([{ type: "fade", count: 1 }]);
    // Avg also excludes custom — it's the no-effect placeholder and
    // counting it would mislead the "how richly do users animate"
    // signal this stat is trying to convey.
    expect(stats.avgEffectsPerProject).toBe(1);
  });

  it("bucket feedback by status", () => {
    const feedback = [
      feedbackRow("open"),
      feedbackRow("open"),
      feedbackRow("replied"),
      feedbackRow("closed"),
      feedbackRow("closed"),
      feedbackRow("closed"),
    ];
    const stats = computeDashboardStats([], [], feedback);
    expect(stats.totalFeedback).toBe(6);
    expect(stats.feedbackOpen).toBe(2);
    expect(stats.feedbackReplied).toBe(1);
    expect(stats.feedbackClosed).toBe(3);
    expect(stats.recentFeedback).toHaveLength(6);
  });

  it("handles empty inputs cleanly (no NaN / no throws)", () => {
    const stats = computeDashboardStats([], [], []);
    expect(stats.totalUsers).toBe(0);
    expect(stats.totalProjects).toBe(0);
    expect(stats.avgEffectsPerProject).toBe(0);
    expect(stats.topEffectTypes).toEqual([]);
    expect(stats.signupTrend).toHaveLength(30);
    expect(stats.signupTrend.every((n) => n === 0)).toBe(true);
  });

  it("handles malformed project data gracefully", () => {
    const projects: AdminProjectRow[] = [
      {
        id: "p1",
        user_id: "u1",
        name: "broken",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        data: null as unknown as AdminProjectRow["data"],
      },
      {
        id: "p2",
        user_id: "u2",
        name: "no layer",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        data: {} as unknown as AdminProjectRow["data"],
      },
    ];
    const stats = computeDashboardStats([], projects, []);
    expect(stats.totalProjects).toBe(2);
    expect(stats.topEffectTypes).toEqual([]);
    expect(stats.avgEffectsPerProject).toBe(0);
  });
});
