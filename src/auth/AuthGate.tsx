import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { isAuthEnabled } from "./supabase";
import { useAuth } from "./useAuth";
import { SignInScreen } from "./SignInScreen";

/**
 * Wraps the app. Behavior:
 * - Auth disabled (no env vars) → render `children` straight through.
 * - Auth loading → small spinner.
 * - Auth enabled + no user → SignInScreen.
 * - Auth enabled + signed in → render `children`.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();

  if (!isAuthEnabled) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (!user) return <SignInScreen />;

  return <>{children}</>;
}
