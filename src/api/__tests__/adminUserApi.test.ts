import { describe, it, expect } from "vitest";
import { removalBlockedReason } from "../adminUserApi";
import type { Profile } from "../profileApi";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-1",
    email: "someone@example.com",
    is_admin: false,
    created_at: new Date().toISOString(),
    last_seen_at: null,
    active_seconds: 0,
    ...overrides,
  };
}

describe("removalBlockedReason", () => {
  it("allows removing an ordinary user", () => {
    expect(removalBlockedReason(profile(), "admin-1")).toBeNull();
  });

  // The hard guarantee lives in firestore.rules (profiles delete requires
  // `resource.data.is_admin != true`); this keeps the button off too.
  it("refuses to remove an admin account", () => {
    expect(removalBlockedReason(profile({ is_admin: true }), "admin-1")).toMatch(
      /admin/i,
    );
  });

  it("refuses to remove yourself", () => {
    expect(removalBlockedReason(profile({ id: "admin-1" }), "admin-1")).toMatch(
      /your own/i,
    );
  });

  it("reports the admin reason first when both apply", () => {
    const self = profile({ id: "admin-1", is_admin: true });
    expect(removalBlockedReason(self, "admin-1")).toMatch(/admin/i);
  });

  it("does not block on identity when the caller is unknown", () => {
    expect(removalBlockedReason(profile(), null)).toBeNull();
  });
});
