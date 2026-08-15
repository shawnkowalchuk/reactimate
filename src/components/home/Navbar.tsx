import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Github, Menu, MessageSquare, Moon, Settings, Shield, Sun, X } from "lucide-react";
import { useThemeStore } from "../../store/themeStore";
import { useAuth } from "../../auth/useAuth";
import { useIsAdmin } from "../../auth/useAdmin";
import { isAuthEnabled } from "../../auth/firebase";
import { SignInScreen } from "../../auth/SignInScreen";

// Rows inside the mobile menu panel: full width, 40px min tap target.
const mobileRowClass =
  "flex items-center gap-2 rounded px-3 py-2.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100";

export function Navbar() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [signInOpen, setSignInOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the sign-in modal once auth succeeds. Without this the SignInScreen
  // sits mounted with its spinner spinning forever after a successful sign-in
  // (the screen's own contract assumes AuthGate will unmount it on the /app
  // route, which doesn't apply when it's hosted in a modal).
  useEffect(() => {
    if (user && signInOpen) setSignInOpen(false);
  }, [user, signInOpen]);

  // Close the mobile menu on navigation. Most links are same-page hashes
  // (/#how), so both pathname and hash have to be watched.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neutral-200/60 bg-white/80 backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight">reactimate</span>
            <span className="text-xs text-neutral-500">Hero Animator</span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm md:flex">
            <Link
              to="/#how"
              className="rounded px-2.5 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              How it works
            </Link>
            <Link
              to="/#examples"
              className="rounded px-2.5 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              Examples
            </Link>
            <Link
              to="/#faq"
              className="rounded px-2.5 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              FAQ
            </Link>
            <Link
              to="/feedback"
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              <MessageSquare size={14} />
              Feedback
            </Link>
            {user && (
              <Link
                to="/settings"
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                title="Account settings"
              >
                <Settings size={14} />
                Settings
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
                title="Admin"
              >
                <Shield size={14} />
                Admin
              </Link>
            )}
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

          <div className="flex items-center gap-1 md:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              aria-label="Toggle theme"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          // The header is `sticky`, i.e. positioned, so this panel anchors to
          // it and overlays the page instead of pushing the content down.
          <div
            id="mobile-menu"
            className="absolute inset-x-0 top-full max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-neutral-200/60 bg-white/95 backdrop-blur md:hidden dark:border-neutral-800/60 dark:bg-neutral-950/95"
          >
            {/* px-3 + each row's own px-3 lines the labels up with the logo's px-6. */}
            <nav className="mx-auto flex max-w-6xl flex-col gap-0.5 px-3 py-3 text-sm">
              <Link to="/#how" onClick={() => setMenuOpen(false)} className={mobileRowClass}>
                How it works
              </Link>
              <Link to="/#examples" onClick={() => setMenuOpen(false)} className={mobileRowClass}>
                Examples
              </Link>
              <Link to="/#faq" onClick={() => setMenuOpen(false)} className={mobileRowClass}>
                FAQ
              </Link>
              <Link to="/feedback" onClick={() => setMenuOpen(false)} className={mobileRowClass}>
                <MessageSquare size={14} />
                Feedback
              </Link>
              {user && (
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className={mobileRowClass}
                  title="Account settings"
                >
                  <Settings size={14} />
                  Settings
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded px-3 py-2.5 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
                  title="Admin"
                >
                  <Shield size={14} />
                  Admin
                </Link>
              )}
              <a
                href="https://github.com/shawnkowalchuk/reactimate"
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className={mobileRowClass}
                title="GitHub"
              >
                <Github size={14} />
                GitHub
              </a>

              {isAuthEnabled && !user && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setSignInOpen(true);
                  }}
                  className="flex items-center gap-2 rounded px-3 py-2.5 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  Sign in
                </button>
              )}

              <Link
                to="/app"
                onClick={() => setMenuOpen(false)}
                className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {user ? "Continue editing" : "Open editor"}
                <ArrowRight size={14} />
              </Link>
            </nav>
          </div>
        )}
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
