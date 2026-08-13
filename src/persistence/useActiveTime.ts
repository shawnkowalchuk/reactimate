import { useEffect, useRef } from "react";
import { isAuthEnabled } from "../auth/firebase";
import { addActiveSeconds } from "../api/profileApi";

/** Stop counting after this long with no pointer/key/scroll input. */
const IDLE_TIMEOUT_MS = 60_000;
/** How often to fold elapsed wall-clock into the pending total. */
const TICK_MS = 5_000;
/** Don't spend a Firestore write on less than this much accrued time. */
const MIN_FLUSH_SECONDS = 60;
/** Periodic flush so a long uninterrupted session isn't lost to a crash. */
const FLUSH_INTERVAL_MS = 5 * 60_000;

/**
 * Accumulate how long this user actually spends working in the editor and
 * fold it into `profiles/{uid}.active_seconds`.
 *
 * "Active" is deliberately strict: the tab must be visible AND have seen
 * pointer, key, or scroll input within `IDLE_TIMEOUT_MS`. Without the idle
 * gate a tab left open overnight would report eight hours of "usage" and
 * make the metric worthless.
 *
 * Write cost is the reason for the thresholds. Time accrues in memory and
 * only reaches Firestore when at least `MIN_FLUSH_SECONDS` has built up,
 * on one of:
 *   - the 5-minute interval (bounds loss if the browser dies)
 *   - the tab being hidden or closed (`visibilitychange` / `pagehide`)
 * A typical session therefore costs 1-2 writes, not one per tick. The same
 * pagehide/visibilitychange pattern the cloud-save flush already uses.
 *
 * No-ops entirely when auth is disabled (the localStorage-only path), so
 * the offline fallback never reaches for the network.
 */
export function useActiveTime(): void {
  // Refs throughout: this hook must never trigger a re-render of its host.
  const pendingRef = useRef(0);
  const lastTickRef = useRef<number>(0);
  const lastInputRef = useRef<number>(0);

  useEffect(() => {
    if (!isAuthEnabled) return;
    if (typeof window === "undefined") return;

    const now = () => performance.now();
    lastTickRef.current = now();
    lastInputRef.current = now();

    const markInput = () => {
      lastInputRef.current = now();
    };

    /**
     * Fold the time since the previous tick into `pending`, but only if the
     * whole interval counted as active. Anything else (tab hidden, user
     * idle) is discarded rather than estimated — undercounting is the safer
     * error for a usage stat.
     */
    const accrue = () => {
      const t = now();
      const elapsedMs = t - lastTickRef.current;
      lastTickRef.current = t;
      if (elapsedMs <= 0) return;
      if (document.visibilityState !== "visible") return;
      if (t - lastInputRef.current > IDLE_TIMEOUT_MS) return;
      pendingRef.current += elapsedMs / 1000;
    };

    /** Push accrued time to Firestore. `force` skips the minimum. */
    const flush = (force = false) => {
      accrue();
      const seconds = pendingRef.current;
      if (seconds <= 0) return;
      if (!force && seconds < MIN_FLUSH_SECONDS) return;
      pendingRef.current = 0;
      void addActiveSeconds(seconds);
    };

    const tick = window.setInterval(accrue, TICK_MS);
    const periodicFlush = window.setInterval(() => flush(), FLUSH_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Leaving the tab: flush whatever is there. Forced, because a short
        // focused burst is still real usage and this may be the last chance.
        flush(true);
      } else {
        // Coming back: restart the clock so the away period isn't counted.
        lastTickRef.current = now();
        lastInputRef.current = now();
      }
    };
    const onPageHide = () => flush(true);

    const inputEvents = ["pointerdown", "pointermove", "keydown", "wheel"];
    for (const e of inputEvents) {
      window.addEventListener(e, markInput, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(periodicFlush);
      for (const e of inputEvents) window.removeEventListener(e, markInput);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      // Unmount (navigating out of the editor) is a session boundary too.
      flush(true);
    };
  }, []);
}
