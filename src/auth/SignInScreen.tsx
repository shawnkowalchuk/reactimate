import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { supabase } from "./supabase";

type Mode = "sign-in" | "sign-up" | "magic-link";

interface FormState {
  email: string;
  password: string;
  mode: Mode;
  pending: boolean;
  message: { kind: "error" | "info"; text: string } | null;
}

const initial: FormState = {
  email: "",
  password: "",
  mode: "sign-in",
  pending: false,
  message: null,
};

export function SignInScreen() {
  const [s, setS] = useState<FormState>(initial);

  const setMode = (mode: Mode) =>
    setS((cur) => ({ ...cur, mode, message: null }));

  const setPending = (pending: boolean) =>
    setS((cur) => ({ ...cur, pending }));

  const setMessage = (
    message: FormState["message"],
  ): void => setS((cur) => ({ ...cur, pending: false, message }));

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || s.pending) return;
    setPending(true);

    try {
      if (s.mode === "magic-link") {
        const { error } = await supabase.auth.signInWithOtp({
          email: s.email,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage({ kind: "info", text: `Check ${s.email} for a sign-in link.` });
        return;
      }

      if (s.mode === "sign-up") {
        const { error } = await supabase.auth.signUp({
          email: s.email,
          password: s.password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage({
          kind: "info",
          text: `Check ${s.email} to confirm your address. Sign in once verified.`,
        });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: s.email,
        password: s.password,
      });
      if (error) throw error;
      // onAuthStateChange will swap the gate to the app.
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  };

  const onOAuth = async (provider: "google" | "apple") => {
    if (!supabase || s.pending) return;
    setPending(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setMessage({ kind: "error", text: error.message });
    }
    // On success Supabase redirects the page — nothing to do here.
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-neutral-100">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">reactimate</h1>
        <p className="mb-6 text-sm text-neutral-500">
          {s.mode === "sign-up"
            ? "Create an account to start animating."
            : s.mode === "magic-link"
              ? "We'll email you a one-time sign-in link."
              : "Sign in to continue."}
        </p>

        <div className="space-y-2">
          <ProviderButton onClick={() => onOAuth("google")} pending={s.pending}>
            <GoogleMark /> Continue with Google
          </ProviderButton>
          <ProviderButton onClick={() => onOAuth("apple")} pending={s.pending}>
            <AppleMark /> Continue with Apple
          </ProviderButton>
        </div>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-neutral-600">
          <span className="h-px flex-1 bg-neutral-800" />
          or with email
          <span className="h-px flex-1 bg-neutral-800" />
        </div>

        <form onSubmit={onEmailSubmit} className="space-y-2">
          <input
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={s.email}
            onChange={(e) => setS((c) => ({ ...c, email: e.target.value }))}
            className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
          {s.mode !== "magic-link" && (
            <input
              type="password"
              autoComplete={s.mode === "sign-up" ? "new-password" : "current-password"}
              required
              minLength={6}
              placeholder="Password"
              value={s.password}
              onChange={(e) => setS((c) => ({ ...c, password: e.target.value }))}
              className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
            />
          )}

          <button
            type="submit"
            disabled={s.pending}
            className="flex w-full items-center justify-center gap-2 rounded bg-neutral-100 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-60"
          >
            {s.pending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            {s.mode === "sign-up"
              ? "Create account"
              : s.mode === "magic-link"
                ? "Email me a magic link"
                : "Sign in"}
          </button>
        </form>

        {s.message && (
          <p
            className={`mt-3 text-xs ${
              s.message.kind === "error" ? "text-red-300" : "text-emerald-300"
            }`}
          >
            {s.message.text}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
          {s.mode === "sign-in" ? (
            <>
              <button type="button" className="hover:text-neutral-300" onClick={() => setMode("sign-up")}>
                New here? Create an account →
              </button>
              <button type="button" className="hover:text-neutral-300" onClick={() => setMode("magic-link")}>
                Use a magic link
              </button>
            </>
          ) : (
            <button type="button" className="hover:text-neutral-300" onClick={() => setMode("sign-in")}>
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProviderButton({
  onClick,
  pending,
  children,
}: {
  onClick: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded border border-neutral-700 bg-neutral-900 py-2 text-sm hover:border-neutral-500 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.6 2.2 12 2.2 6.5 2.2 2.1 6.6 2.1 12.1S6.5 22 12 22c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.3H12z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16.4 12.7c0-2.4 2-3.5 2.1-3.6-1.2-1.7-3-2-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.3.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.4-.8 1.5 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.2-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM14.1 5.3c.7-.8 1.1-2 1-3.1-1 0-2.2.6-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.4z" />
    </svg>
  );
}
