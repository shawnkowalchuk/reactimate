import type { UserIdentity } from "@supabase/supabase-js";
import { supabase } from "../auth/supabase";

export type LinkableProvider = "google" | "apple";

/** Read the identities attached to the current user. */
export async function getMyIdentities(): Promise<UserIdentity[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) {
    console.warn("getMyIdentities:", error.message);
    return [];
  }
  return data?.identities ?? [];
}

/**
 * Start the OAuth flow to attach a new identity to the current user.
 * Requires "Manual Linking" enabled in Supabase → Authentication →
 * Sign In / Up. On success, Supabase redirects back to /settings and
 * the new identity appears in `getMyIdentities()`.
 */
export async function linkProvider(provider: LinkableProvider): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't configured.");
  const { error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: `${window.location.origin}/settings` },
  });
  if (error) throw new Error(error.message);
}

/** Remove a linked identity. Caller must ensure ≥1 identity remains. */
export async function unlinkIdentityById(
  identity: UserIdentity,
): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't configured.");
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) throw new Error(error.message);
}

/**
 * Set (or change) the password on the current user's account.
 * Works for users created via email/password OR users created via
 * OAuth who want to add a password.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't configured.");
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
