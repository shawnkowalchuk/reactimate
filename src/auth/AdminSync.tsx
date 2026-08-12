import { useAdminSync } from "./useAdmin";

/**
 * Headless mount point — subscribes the admin store to Firebase auth changes
 * so the cached profile (incl. `is_admin`) stays fresh across the whole app.
 */
export function AdminSync() {
  useAdminSync();
  return null;
}
