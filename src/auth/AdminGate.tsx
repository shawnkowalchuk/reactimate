import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { isAuthEnabled } from "./supabase";
import { useAuth } from "./useAuth";
import { useAdminStore } from "./useAdmin";
import { SignInScreen } from "./SignInScreen";

/**
 * Wraps admin routes. Behavior:
 *  - Supabase not configured → setup-required message
 *  - Loading session → spinner
 *  - Signed out         → SignInScreen
 *  - Signed in, profile not yet loaded → spinner
 *  - Signed in, not admin → 403
 *  - Signed in + admin    → children
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();
  const profile = useAdminStore((s) => s.profile);
  const profileLoading = useAdminStore((s) => s.loading);

  if (!isAuthEnabled) {
    return <SetupRequired />;
  }
  if (isLoading) return <Spinner />;
  if (!user) return <SignInScreen />;
  if (profileLoading && profile === null) return <Spinner />;
  if (!profile?.is_admin) return <ForbiddenScreen email={user.email ?? null} />;

  return <>{children}</>;
}

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-white text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
      <Loader2 size={18} className="animate-spin" />
    </div>
  );
}

function SetupRequired() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-6 text-neutral-700 dark:text-neutral-300">
      <ShieldAlert size={28} className="text-amber-500" />
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        Admin requires Supabase
      </h1>
      <p className="text-sm">
        Configure <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">VITE_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">VITE_SUPABASE_ANON_KEY</code>, run{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">supabase/schema.sql</code>{" "}
        in the Supabase SQL Editor, then mark yourself as admin:
      </p>
      <pre className="w-full overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
        update public.profiles set is_admin = true where email = 'you@example.com';
      </pre>
      <Link
        to="/"
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:border-neutral-500 dark:border-neutral-700"
      >
        Back to home
      </Link>
    </div>
  );
}

function ForbiddenScreen({ email }: { email: string | null }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-6 text-neutral-700 dark:text-neutral-300">
      <ShieldAlert size={28} className="text-rose-500" />
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        Not authorized
      </h1>
      <p className="text-sm">
        You're signed in as <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">{email ?? "anonymous"}</code> but that
        account isn't an admin. Promote it with:
      </p>
      <pre className="w-full overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
        {`update public.profiles set is_admin = true where email = '${email ?? "you@example.com"}';`}
      </pre>
      <Link
        to="/"
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:border-neutral-500 dark:border-neutral-700"
      >
        Back to home
      </Link>
    </div>
  );
}
