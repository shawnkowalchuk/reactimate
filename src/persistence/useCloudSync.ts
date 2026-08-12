import { useEffect, useRef } from "react";
import { isAuthEnabled } from "../auth/firebase";
import { useAuth } from "../auth/useAuth";
import { useProjectStore } from "../store/projectStore";
import { loadFromCloudOrMigrate } from "./localStorage";

import { clearShadowFlag, isShadowProject, markShadowProject } from "./shadowFlag";

let _skipNext = false;

/** Call before setProject() when loading an example — prevents the cloud
 *  sync from immediately overwriting the example project. Also marks the
 *  project as "shadow" so the Save button can warn before clobbering the
 *  user's cloud project with the example, and the autosave pipeline skips
 *  pushing to the DB until the user explicitly confirms. */
export function markSkipCloudSync() {
  _skipNext = true;
  markShadowProject();
}

// Re-export for consumers that already imported from this module so we
// don't have to change every call site.
export { isShadowProject, clearShadowFlag };

/**
 * Once auth resolves to a signed-in user, tries to pull the latest
 * project from Firestore. If the DB has data, it replaces the current
 * editor project. If the DB is empty but localStorage has data, that
 * data is migrated to the DB. Runs only once per session.
 *
 * If `markSkipCloudSync()` was called (e.g. the user opened an example
 * from the homepage), the cloud pull is skipped and the example project
 * is kept in the editor.
 */
export function useCloudSync() {
  const { user } = useAuth();
  const setProject = useProjectStore((s) => s.setProject);
  const ran = useRef(false);

  useEffect(() => {
    if (!isAuthEnabled || !user || ran.current) return;
    if (_skipNext) {
      _skipNext = false;
      ran.current = true;
      return;
    }
    ran.current = true;
    loadFromCloudOrMigrate().then((p) => {
      if (p) setProject(p);
    });
  }, [user, setProject]);
}
