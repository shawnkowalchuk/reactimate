import { useState, type ReactNode } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { sendEmailVerification } from "firebase/auth";
import { auth, isAuthEnabled } from "./firebase";
import { signOut, useAuth, type AuthUser } from "./useAuth";
import { SignInScreen } from "./SignInScreen";

/**
 * Wraps the app. Behavior:
 * - Auth disabled (no env var) → render `children` straight through.
 * - Auth loading → small spinner.
 * - Auth enabled + no user → SignInScreen.
 * - Password-only account with unverified email → verify screen
 *   (Firebase signs users in before verification; Supabase didn't, so
 *   this preserves the old "confirm your address first" behavior).
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

  if (needsEmailVerification(user)) return <VerifyEmailScreen user={user} />;

  return <>{children}</>;
}

function needsEmailVerification(user: AuthUser): boolean {
  return (
    !user.emailVerified &&
    user.providerIds.length > 0 &&
    user.providerIds.every((p) => p === "password")
  );
}

function VerifyEmailScreen({ user }: { user: AuthUser }) {
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "checking"
  >("idle");

  const resend = async () => {
    if (!auth?.currentUser || status === "sending") return;
    setStatus("sending");
    try {
      await sendEmailVerification(auth.currentUser, {
        url: window.location.origin,
      });
      setStatus("sent");
    } catch {
      setStatus("idle");
    }
  };

  const recheck = async () => {
    if (!auth?.currentUser || status === "checking") return;
    setStatus("checking");
    // reload() refreshes emailVerified from the server; a full page reload
    // then re-runs the gate with the fresh flag.
    await auth.currentUser.reload().catch(() => undefined);
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-neutral-100">
      <div className="w-full max-w-sm">
        <MailCheck size={24} className="mb-3 text-emerald-400" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Verify your email
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          We sent a verification link to{" "}
          <span className="text-neutral-200">{user.email ?? "your inbox"}</span>.
          Click it, then come back here.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void recheck()}
            className="flex items-center gap-2 rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
          >
            {status === "checking" && (
              <Loader2 size={14} className="animate-spin" />
            )}
            I've verified — continue
          </button>
          <button
            type="button"
            onClick={() => void resend()}
            disabled={status === "sending" || status === "sent"}
            className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm hover:border-neutral-500 disabled:opacity-60"
          >
            {status === "sent" ? "Sent — check your inbox" : "Resend email"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 text-xs text-neutral-500 hover:text-neutral-300"
        >
          Use a different account
        </button>
      </div>
    </div>
  );
}
