import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Users,
  X,
} from "lucide-react";
import { signOut, useAuth } from "../../auth/useAuth";
import { useAdminBadgeStore } from "../../store/adminBadgeStore";

// py-2.5 keeps the row at a 40px touch target inside the mobile drawer; the
// sidebar itself only renders at md and up, where md:py-2 restores its density.
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-2.5 text-sm md:py-2 ${
    isActive
      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
  }`;

// Shared by the md+ sidebar and the mobile drawer so the two can't drift.
// `onNavigate` is only passed by the drawer, which has to close on a click.
function AdminNavLinks({
  openFeedback,
  onNavigate,
}: {
  openFeedback: number;
  onNavigate?: () => void;
}) {
  return (
    <>
      <NavLink to="/admin" end className={navLinkClass} onClick={onNavigate}>
        <LayoutDashboard size={14} />
        Dashboard
      </NavLink>
      <NavLink to="/admin/users" className={navLinkClass} onClick={onNavigate}>
        <Users size={14} />
        Users
      </NavLink>
      <NavLink to="/admin/feedback" className={navLinkClass} onClick={onNavigate}>
        <MessageSquare size={14} />
        Feedback
        {openFeedback > 0 && (
          <span
            className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white"
            title={`${openFeedback} awaiting a reply`}
            aria-label={`${openFeedback} unread feedback`}
          >
            {openFeedback > 99 ? "99+" : openFeedback}
          </span>
        )}
      </NavLink>
    </>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const openFeedback = useAdminBadgeStore((s) => s.openFeedback);
  const ensureBadge = useAdminBadgeStore((s) => s.ensure);
  const [menuOpen, setMenuOpen] = useState(false);

  // Cached in the store, so this re-mount-per-navigation costs one read
  // for the whole admin session rather than one per page view.
  useEffect(() => {
    void ensureBadge();
  }, [ensureBadge]);

  // Close the mobile drawer on navigation. The layout re-mounts per admin page
  // so this is belt-and-braces, but it also covers a re-click of the open route.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900 md:grid md:grid-cols-[220px_minmax(0,1fr)] dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-neutral-50 md:hidden dark:border-neutral-800 dark:bg-neutral-925">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            aria-label={menuOpen ? "Close admin menu" : "Open admin menu"}
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-nav"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
            {/* The Feedback badge lives inside the drawer, so mirror it on the
                toggle while the drawer is shut. */}
            {openFeedback > 0 && !menuOpen && (
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500"
                aria-hidden="true"
              />
            )}
          </button>
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight">reactimate</span>
            <span className="text-xs text-neutral-500">Admin</span>
          </Link>
        </div>

        {menuOpen && (
          // The header is `sticky`, i.e. positioned, so this drawer anchors to
          // it and overlays the page instead of pushing the content down.
          <div
            id="admin-mobile-nav"
            className="absolute inset-x-0 top-full max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-neutral-200 bg-neutral-50 shadow-lg dark:border-neutral-800 dark:bg-neutral-925"
          >
            <nav className="space-y-1 p-3">
              <AdminNavLinks
                openFeedback={openFeedback}
                onNavigate={() => setMenuOpen(false)}
              />
            </nav>
            <div className="border-t border-neutral-200 px-3 py-3 text-xs text-neutral-500 dark:border-neutral-800">
              <div className="mb-2 truncate" title={user?.email ?? ""}>
                {user?.email}
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to="/app"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-10 flex-1 items-center justify-center gap-1 rounded border border-neutral-300 px-2 hover:border-neutral-500 dark:border-neutral-700"
                  title="Open editor"
                >
                  <ArrowLeft size={12} />
                  Editor
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  title="Sign out"
                  aria-label="Sign out"
                  className="inline-flex h-10 w-10 items-center justify-center rounded border border-neutral-300 hover:border-neutral-500 dark:border-neutral-700"
                >
                  <LogOut size={12} />
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
      <aside className="hidden flex-col border-r border-neutral-200 bg-neutral-50 md:flex dark:border-neutral-800 dark:bg-neutral-925">
        <div className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight">reactimate</span>
            <span className="text-xs text-neutral-500">Admin</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <AdminNavLinks openFeedback={openFeedback} />
        </nav>
        <footer className="border-t border-neutral-200 px-3 py-3 text-xs text-neutral-500 dark:border-neutral-800">
          <div className="mb-2 truncate" title={user?.email ?? ""}>
            {user?.email}
          </div>
          <div className="flex items-center gap-1">
            <Link
              to="/app"
              className="flex flex-1 items-center justify-center gap-1 rounded border border-neutral-300 px-2 py-1 hover:border-neutral-500 dark:border-neutral-700"
              title="Open editor"
            >
              <ArrowLeft size={12} />
              Editor
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              title="Sign out"
              className="rounded border border-neutral-300 px-2 py-1 hover:border-neutral-500 dark:border-neutral-700"
            >
              <LogOut size={12} />
            </button>
          </div>
        </footer>
      </aside>
      <main key={location.pathname} className="overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>
    </div>
  );
}
