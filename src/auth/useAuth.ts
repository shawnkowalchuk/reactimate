import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface AuthState {
  /** True until the initial session lookup completes. */
  isLoading: boolean;
  /** Currently signed-in user, or null. */
  user: User | null;
  /** Currently active session, or null. */
  session: Session | null;
}

/**
 * Subscribes to Supabase auth state. If auth isn't configured (no env
 * vars), returns a stable "loaded, no user" state — callers should use
 * `isAuthEnabled` from ./supabase to decide whether to gate the app.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => ({
    isLoading: supabase !== null,
    user: null,
    session: null,
  }));

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setState({
        isLoading: false,
        user: data.session?.user ?? null,
        session: data.session,
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        isLoading: false,
        user: session?.user ?? null,
        session,
      });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
