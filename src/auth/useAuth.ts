import { useEffect, useState } from "react";
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { ensureMyProfile } from "../api/profileApi";

/** localStorage key holding the email a magic link was requested for. */
export const EMAIL_FOR_SIGN_IN_KEY = "reactimate.emailForSignIn";

/**
 * App-level user shape, adapted from the Firebase User so components
 * don't depend on SDK internals (and legacy `user.id` / `user.created_at`
 * call sites keep working).
 */
export interface AuthUser {
  /** Firebase uid. */
  id: string;
  email: string | null;
  /** ISO account-creation time, or null if unknown. */
  created_at: string | null;
  emailVerified: boolean;
  /** Firebase provider ids, e.g. ["password", "google.com"]. */
  providerIds: string[];
}

function toAuthUser(u: User): AuthUser {
  const created = u.metadata.creationTime;
  return {
    id: u.uid,
    email: u.email,
    created_at: created ? new Date(created).toISOString() : null,
    emailVerified: u.emailVerified,
    providerIds: u.providerData.map((p) => p.providerId),
  };
}

export interface AuthState {
  /** True until the initial session restore completes. */
  isLoading: boolean;
  /** Currently signed-in user, or null. */
  user: AuthUser | null;
}

/**
 * If the current URL is a magic-link (email-link) sign-in, complete it
 * before any auth listeners report state — otherwise the gate would flash
 * "signed out" while the link is being redeemed. The email is read from
 * localStorage (stored when the link was requested); if the link is opened
 * on a different device we fall back to a prompt, per Firebase's flow.
 */
const emailLinkRedeemed: Promise<void> = (async () => {
  if (!auth || typeof window === "undefined") return;
  if (!isSignInWithEmailLink(auth, window.location.href)) return;
  const stored = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
  const email =
    stored ?? window.prompt("Confirm your email to finish signing in") ?? "";
  if (!email) return;
  try {
    await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
    // Scrub the one-time code from the URL so refresh/bookmark doesn't
    // retry a spent link.
    window.history.replaceState(null, "", window.location.pathname);
  } catch (err) {
    console.warn("magic link sign-in:", err);
  }
})();

/**
 * Subscribes to Firebase auth state. If auth isn't configured (no env
 * var), returns a stable "loaded, no user" state — callers should use
 * `isAuthEnabled` from ./firebase to decide whether to gate the app.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => ({
    isLoading: auth !== null,
    user: null,
  }));

  useEffect(() => {
    if (!auth) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void emailLinkRedeemed.then(() => {
      if (cancelled || !auth) return;
      unsubscribe = onAuthStateChanged(auth, (u) => {
        if (u) void ensureMyProfile(u.uid, u.email);
        setState({ isLoading: false, user: u ? toAuthUser(u) : null });
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return state;
}

export async function signOut(): Promise<void> {
  if (!auth) return;
  await firebaseSignOut(auth);
}
