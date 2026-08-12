import { useEffect } from "react";
import { create } from "zustand";
import { onAuthStateChanged } from "firebase/auth";
import { auth, isAuthEnabled } from "./firebase";
import { fetchMyProfile, type Profile } from "../api/profileApi";

export interface AdminState {
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  profile: null,
  loading: false,
  refresh: async () => {
    if (!isAuthEnabled) {
      set({ profile: null, loading: false });
      return;
    }
    set({ loading: true });
    const p = await fetchMyProfile();
    set({ profile: p, loading: false });
  },
}));

/**
 * Subscribes to auth changes and refreshes the cached profile (which carries
 * `is_admin`). Mounted once at the app root.
 */
export function useAdminSync() {
  const refresh = useAdminStore((s) => s.refresh);

  useEffect(() => {
    if (!auth) return;
    // onAuthStateChanged fires immediately with the restored session, so
    // this covers both the initial load and later sign-in/sign-out.
    return onAuthStateChanged(auth, () => {
      void refresh();
    });
  }, [refresh]);
}

export function useIsAdmin(): boolean {
  return useAdminStore((s) => s.profile?.is_admin === true);
}
