import { create } from "zustand";
import { countOpenFeedback } from "../api/feedbackApi";

export interface AdminBadgeState {
  /** Feedback threads awaiting a reply. 0 until the first fetch resolves. */
  openFeedback: number;
  /** True once a fetch has completed, so the badge doesn't flash on nav. */
  loaded: boolean;
  /** Fetch once per session. Subsequent calls are no-ops. */
  ensure: () => Promise<void>;
  /** Force a re-fetch — call after replying to or closing a thread. */
  refresh: () => Promise<void>;
}

/**
 * Backs the unread count on the admin nav's Feedback link.
 *
 * `AdminLayout` re-mounts on every admin page navigation, so fetching in
 * its effect directly would re-read on each click. Caching here keeps it
 * to one aggregation read per admin session, with an explicit `refresh`
 * for the places that actually change the count.
 */
export const useAdminBadgeStore = create<AdminBadgeState>((set, get) => ({
  openFeedback: 0,
  loaded: false,
  ensure: async () => {
    if (get().loaded) return;
    const count = await countOpenFeedback();
    set({ openFeedback: count, loaded: true });
  },
  refresh: async () => {
    const count = await countOpenFeedback();
    set({ openFeedback: count, loaded: true });
  },
}));
