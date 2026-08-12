import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  linkWithPopup,
  unlink,
  updatePassword as firebaseUpdatePassword,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "../auth/firebase";

export type LinkableProvider = "google" | "apple";

export type IdentityProvider = "email" | "google" | "apple";

/** A sign-in method attached to the current account. */
export interface Identity {
  /** Stable per-user key — the Firebase provider id. */
  id: string;
  provider: IdentityProvider;
  /** Email associated with this provider, if any. */
  email: string | null;
}

const FIREBASE_PROVIDER_ID: Record<LinkableProvider, string> = {
  google: GoogleAuthProvider.PROVIDER_ID, // "google.com"
  apple: "apple.com",
};

function toIdentityProvider(firebaseId: string): IdentityProvider | null {
  switch (firebaseId) {
    case EmailAuthProvider.PROVIDER_ID: // "password"
      return "email";
    case GoogleAuthProvider.PROVIDER_ID:
      return "google";
    case "apple.com":
      return "apple";
    default:
      return null;
  }
}

/** Read the identities attached to the current user. */
export async function getMyIdentities(): Promise<Identity[]> {
  const user = auth?.currentUser;
  if (!user) return [];
  const identities: Identity[] = [];
  for (const info of user.providerData) {
    const provider = toIdentityProvider(info.providerId);
    if (!provider) continue;
    identities.push({ id: info.providerId, provider, email: info.email });
  }
  return identities;
}

/**
 * Attach a new OAuth identity to the current user via a popup. Resolves
 * once the provider is linked (no page redirect involved).
 */
export async function linkProvider(provider: LinkableProvider): Promise<void> {
  const user = auth?.currentUser;
  if (!auth || !user) throw new Error("Sign in first.");
  const oauth =
    provider === "google"
      ? new GoogleAuthProvider()
      : new OAuthProvider("apple.com");
  try {
    await linkWithPopup(user, oauth);
  } catch (err) {
    throw new Error(friendlyAuthError(err, "Couldn't link that provider."));
  }
}

/** Remove a linked identity. Caller must ensure ≥1 identity remains. */
export async function unlinkIdentityById(identity: Identity): Promise<void> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in first.");
  const firebaseId =
    identity.provider === "email"
      ? EmailAuthProvider.PROVIDER_ID
      : FIREBASE_PROVIDER_ID[identity.provider];
  try {
    await unlink(user, firebaseId);
  } catch (err) {
    throw new Error(friendlyAuthError(err, "Unlink failed."));
  }
}

/**
 * Set (or change) the password on the current user's account. Works for
 * users created via email/password OR users created via OAuth who want to
 * add a password (Firebase links the password provider on first set).
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in first.");
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  try {
    await firebaseUpdatePassword(user, newPassword);
  } catch (err) {
    throw new Error(friendlyAuthError(err, "Couldn't update password."));
  }
}

/** Map Firebase auth error codes to copy a human wants to read. */
export function friendlyAuthError(err: unknown, fallback: string): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/requires-recent-login":
        return "For security, this needs a fresh sign-in. Sign out, sign back in, and try again.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Wrong email or password.";
      case "auth/email-already-in-use":
        return "An account with this email already exists. Try signing in instead.";
      case "auth/credential-already-in-use":
        return "That provider account is already linked to a different user.";
      case "auth/account-exists-with-different-credential":
        return "An account with this email exists under a different sign-in method. Sign in that way, then link providers in Settings.";
      case "auth/invalid-email":
        return "That doesn't look like a valid email address.";
      case "auth/weak-password":
        return "Password must be at least 8 characters.";
      case "auth/too-many-requests":
        return "Too many attempts — wait a bit and try again.";
      case "auth/popup-blocked":
        return "Your browser blocked the sign-in popup. Allow popups for this site and retry.";
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return "Sign-in window was closed before finishing.";
      default:
        return err.message.replace(/^Firebase:\s*/, "");
    }
  }
  return err instanceof Error ? err.message : fallback;
}
