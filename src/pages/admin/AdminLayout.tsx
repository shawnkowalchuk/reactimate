import { useEffect, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Users,
} from "lucide-react";
import { signOut, useAuth } from "../../auth/useAuth";
import { useAdminBadgeStore } from "../../store/adminBadgeStore";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
    isActive
      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
  }`;

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const openFeedback = useAdminBadgeStore((s) => s.openFeedback);
  const ensureBadge = useAdminBadgeStore((s) => s.ensure);

  // Cached in the store, so this re-mount-per-navigation costs one read
  // for the whole admin session rather than one per page view.
  useEffect(() => {
    void ensureBadge();
  }, [ensureBadge]);

  return (
    <div className="grid min-h-screen grid-cols-[220px_minmax(0,1fr)] bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <aside className="flex flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-925">
        <div className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight">reactimate</span>
            <span className="text-xs text-neutral-500">Admin</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavLink to="/admin" end className={navLinkClass}>
            <LayoutDashboard size={14} />
            Dashboard
          </NavLink>
          <NavLink to="/admin/users" className={navLinkClass}>
            <Users size={14} />
            Users
          </NavLink>
          <NavLink to="/admin/feedback" className={navLinkClass}>
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
        <div className="mx-auto max-w-5xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
