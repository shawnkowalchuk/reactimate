import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Github, Moon, Sun } from "lucide-react";
import { useThemeStore } from "../../store/themeStore";
import { useAuth } from "../../auth/useAuth";
import { isAuthEnabled } from "../../auth/supabase";
import { SignInScreen } from "../../auth/SignInScreen";

export function Navbar() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const { user } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neutral-200/60 bg-white/80 backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight">reactimate</span>
            <span className="text-xs text-neutral-500">Hero Animator</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <a
              href="#how"
              className="rounded px-2.5 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              How it works
            </a>
            <a
              href="#examples"
              className="rounded px-2.5 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              Examples
            </a>
            <a
              href="https://github.com/shawnkowalchuk/reactimate"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded px-2.5 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 sm:inline-flex dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              title="GitHub"
            >
              <Github size={14} />
              GitHub
            </a>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              aria-label="Toggle theme"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {isAuthEnabled && !user && (
              <button
                type="button"
                onClick={() => setSignInOpen(true)}
                className="rounded px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                Sign in
              </button>
            )}

            <Link
              to="/app"
              className="ml-1 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {user ? "Continue editing" : "Open editor"}
              <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      </header>

      {signInOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSignInOpen(false);
          }}
        >
          <div className="absolute inset-0">
            <SignInScreen />
          </div>
          <button
            type="button"
            onClick={() => setSignInOpen(false)}
            className="absolute right-4 top-4 rounded bg-neutral-800/80 px-3 py-1 text-sm text-white hover:bg-neutral-700"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
