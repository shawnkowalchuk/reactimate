import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Apple,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
} from "lucide-react";
import type { UserIdentity } from "@supabase/supabase-js";
import { Navbar } from "../components/home/Navbar";
import { Footer } from "../components/home/Footer";
import { isAuthEnabled } from "../auth/supabase";
import { signOut, useAuth } from "../auth/useAuth";
import {
  getMyIdentities,
  linkProvider,
  unlinkIdentityById,
  updatePassword,
  type LinkableProvider,
} from "../api/identityApi";

export function SettingsPage() {
  useEffect(() => {
    document.title = "Settings · reactimate";
  }, []);

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Manage your sign-in methods and account.
        </p>
        <Body />
      </main>
      <Footer />
    </div>
  );
}

function Body() {
  if (!isAuthEnabled) return <NotConfigured />;
  return <SignedInOrPrompt />;
}

function NotConfigured() {
  return (
    <div className="mt-8 rounded-lg border border-amber-300/60 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      Settings requires Supabase auth. Set <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">VITE_SUPABASE_URL</code>{" "}
      and <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">VITE_SUPABASE_ANON_KEY</code> in <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">.env.local</code>{" "}
      and restart the dev server.
    </div>
  );
}

function SignedInOrPrompt() {
  const { isLoading, user } = useAuth();
  if (isLoading) {
    return (
      <div className="mt-8 flex items-center gap-2 text-sm text-neutral-500">
        <Loader2 size={14} className="animate-spin" />
        Loading…
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-5 text-sm dark:border-neutral-800 dark:bg-neutral-950">
        <p className="mb-3 text-neutral-700 dark:text-neutral-300">
          You're not signed in.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Back to home
        </Link>
      </div>
    );
  }
  return <Cards />;
}

function Cards() {
  return (
    <div className="mt-8 space-y-6">
      <ProfileCard />
      <SignInMethodsCard />
      <ChangePasswordCard />
      <AccountCard />
    </div>
  );
}

/* ============================================================
 * Profile (read-only)
 * ============================================================ */

function ProfileCard() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Email" value={user.email ?? "—"} />
        <Row
          label="Joined"
          value={
            user.created_at ? new Date(user.created_at).toLocaleString() : "—"
          }
        />
        <Row label="Account ID" value={user.id} mono />
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-24 shrink-0 text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </dt>
      <dd
        className={`min-w-0 flex-1 truncate text-neutral-800 dark:text-neutral-200 ${mono ? "font-mono text-xs" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

/* ============================================================
 * Sign-in methods
 * ============================================================ */

function SignInMethodsCard() {
  const { user } = useAuth();
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    kind: "info" | "error";
    text: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await getMyIdentities();
    setIdentities(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!user) return null;

  const findIdentity = (provider: string) =>
    identities.find((i) => i.provider === provider);

  // Disallow unlinking the last remaining identity.
  const canUnlink = identities.length > 1;

  const onLink = async (provider: LinkableProvider) => {
    setBusy(provider);
    setMessage(null);
    try {
      await linkProvider(provider);
      // The page redirects via OAuth; this code path resumes only on error
      // (or when the popup gets blocked).
    } catch (err) {
      setBusy(null);
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Couldn't start linking.",
      });
    }
  };

  const onUnlink = async (identity: UserIdentity) => {
    if (!canUnlink) return;
    if (
      !window.confirm(
        `Unlink ${labelFor(identity.provider)} from your account?`,
      )
    ) {
      return;
    }
    setBusy(identity.id);
    setMessage(null);
    try {
      await unlinkIdentityById(identity);
      setMessage({
        kind: "info",
        text: `${labelFor(identity.provider)} unlinked.`,
      });
      await refresh();
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Unlink failed.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold tracking-tight">Sign-in methods</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Link multiple providers to the same account so you can sign in any way you like. You must keep at least one method active.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          <ProviderRow
            icon={<Mail size={16} className="text-neutral-500" />}
            label="Email & password"
            providerKey="email"
            identity={findIdentity("email")}
            // Email identity is created with the account; can't link it on
            // demand from here. Use Change Password below to set/reset.
            actionable={false}
            canUnlink={canUnlink}
            busy={busy}
            onLink={onLink}
            onUnlink={onUnlink}
          />
          <ProviderRow
            icon={<GoogleMark />}
            label="Google"
            providerKey="google"
            identity={findIdentity("google")}
            actionable
            canUnlink={canUnlink}
            busy={busy}
            onLink={onLink}
            onUnlink={onUnlink}
          />
          <ProviderRow
            icon={<Apple size={16} className="text-neutral-500" />}
            label="Apple"
            providerKey="apple"
            identity={findIdentity("apple")}
            actionable
            canUnlink={canUnlink}
            busy={busy}
            onLink={onLink}
            onUnlink={onUnlink}
          />
        </ul>
      )}

      {message && (
        <p
          className={`mt-3 text-xs ${
            message.kind === "error"
              ? "text-rose-600 dark:text-rose-400"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {message.text}
        </p>
      )}

      <p className="mt-3 text-[11px] text-neutral-500">
        Heads-up: linking requires "Manual Linking" enabled in your Supabase project under <em>Authentication → Sign In / Up</em>, and the relevant provider configured under <em>Authentication → Providers</em>.
      </p>
    </section>
  );
}

interface ProviderRowProps {
  icon: React.ReactNode;
  label: string;
  providerKey: string;
  identity: UserIdentity | undefined;
  /** False for email (handled via the Change Password card instead). */
  actionable: boolean;
  canUnlink: boolean;
  busy: string | null;
  onLink: (provider: LinkableProvider) => Promise<void>;
  onUnlink: (identity: UserIdentity) => Promise<void>;
}

function ProviderRow({
  icon,
  label,
  providerKey,
  identity,
  actionable,
  canUnlink,
  busy,
  onLink,
  onUnlink,
}: ProviderRowProps) {
  const linked = Boolean(identity);
  const isBusy = busy === providerKey || (identity && busy === identity.id);
  const subEmail =
    typeof identity?.identity_data?.email === "string"
      ? identity.identity_data.email
      : null;

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-7 w-7 place-items-center rounded bg-neutral-100 dark:bg-neutral-900">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="font-medium">{label}</div>
          {linked && (
            <div className="truncate text-xs text-neutral-500">
              {subEmail ? subEmail : "Linked"}
            </div>
          )}
        </div>
        {linked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            <Check size={10} />
            linked
          </span>
        )}
      </div>

      <div className="shrink-0">
        {linked ? (
          actionable ? (
            <button
              type="button"
              disabled={!!isBusy || !canUnlink}
              onClick={() => identity && void onUnlink(identity)}
              className="rounded border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-800 hover:border-rose-500 hover:text-rose-600 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-rose-400 dark:hover:text-rose-300"
              title={
                !canUnlink
                  ? "Can't unlink the only remaining method"
                  : "Unlink"
              }
            >
              {isBusy ? "…" : "Unlink"}
            </button>
          ) : (
            <span className="text-[11px] text-neutral-500">primary</span>
          )
        ) : actionable ? (
          <button
            type="button"
            disabled={!!isBusy}
            onClick={() => void onLink(providerKey as LinkableProvider)}
            className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {isBusy ? "…" : "Link"}
          </button>
        ) : (
          <span className="text-[11px] text-neutral-500">unavailable</span>
        )}
      </div>
    </li>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.6 2.2 12 2.2 6.5 2.2 2.1 6.6 2.1 12.1S6.5 22 12 22c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.3H12z" />
    </svg>
  );
}

function labelFor(provider: string): string {
  switch (provider) {
    case "email":
      return "Email & password";
    case "google":
      return "Google";
    case "apple":
      return "Apple";
    default:
      return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}

/* ============================================================
 * Change password
 * ============================================================ */

function ChangePasswordCard() {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    kind: "info" | "error";
    text: string;
  } | null>(null);

  const tooShort = pwd.length > 0 && pwd.length < 8;
  const mismatch = confirm.length > 0 && pwd !== confirm;
  const submitDisabled = submitting || pwd.length < 8 || pwd !== confirm;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitDisabled) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await updatePassword(pwd);
      setPwd("");
      setConfirm("");
      setMessage({ kind: "info", text: "Password updated." });
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Couldn't update password.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Lock size={16} className="text-neutral-500" />
        Change password
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Minimum 8 characters. Sets a password on the account if you only signed up with OAuth.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-2">
        <PwdField
          value={pwd}
          onChange={setPwd}
          show={showPwd}
          toggle={() => setShowPwd((v) => !v)}
          placeholder="New password"
          autoComplete="new-password"
          invalid={tooShort}
        />
        {tooShort && (
          <p className="text-[11px] text-amber-500">At least 8 characters.</p>
        )}
        <PwdField
          value={confirm}
          onChange={setConfirm}
          show={showConfirm}
          toggle={() => setShowConfirm((v) => !v)}
          placeholder="Confirm new password"
          autoComplete="new-password"
          invalid={mismatch}
        />
        {mismatch && (
          <p className="text-[11px] text-rose-500">Passwords don't match.</p>
        )}

        {message && (
          <p
            className={`text-xs ${
              message.kind === "error"
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitDisabled}
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ShieldCheck size={14} />
            )}
            Update password
          </button>
        </div>
      </form>
    </section>
  );
}

function PwdField({
  value,
  onChange,
  show,
  toggle,
  placeholder,
  autoComplete,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggle: () => void;
  placeholder: string;
  autoComplete: string;
  invalid: boolean;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={8}
        required
        className={`w-full rounded border bg-white py-2 pl-3 pr-10 text-sm dark:bg-neutral-900 ${
          invalid
            ? "border-rose-500/60 focus:border-rose-400"
            : "border-neutral-300 focus:border-neutral-500 dark:border-neutral-700"
        } focus:outline-none`}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

/* ============================================================
 * Account (sign out + delete-account note)
 * ============================================================ */

function AccountCard() {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold tracking-tight">Account</h2>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Sign out of this browser. Your projects stay saved.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>

      <hr className="my-4 border-neutral-200 dark:border-neutral-800" />

      <details className="text-sm">
        <summary className="cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200">
          Delete my account
        </summary>
        <p className="mt-2 text-xs text-neutral-500">
          Account deletion isn't self-serve yet. Submit a request through the{" "}
          <Link to="/feedback" className="underline hover:text-neutral-700 dark:hover:text-neutral-200">
            Feedback page
          </Link>{" "}
          with the subject "Delete account" and we'll remove your account and all associated data.
        </p>
      </details>
    </section>
  );
}
