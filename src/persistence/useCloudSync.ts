import { useEffect, useRef } from "react";
import { isAuthEnabled } from "../auth/supabase";
import { useAuth } from "../auth/useAuth";
import { useProjectStore } from "../store/projectStore";
import { loadFromCloudOrMigrate } from "./localStorage";

let _skipNext = false;

/** Call before setProject() when loading an example — prevents the cloud
 *  sync from immediately overwriting the example project. */
export function markSkipCloudSync() {
  _skipNext = true;
}

/**
 * Once auth resolves to a signed-in user, tries to pull the latest
 * project from Supabase. If the DB has data, it replaces the current
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
