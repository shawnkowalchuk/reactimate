import { LogOut } from "lucide-react";
import { isAuthEnabled } from "../../auth/supabase";
import { signOut, useAuth } from "../../auth/useAuth";

export function UserMenu() {
  const { user } = useAuth();

  if (!isAuthEnabled || !user) return null;

  return (
    <div className="flex items-center gap-2 border-l border-neutral-200 pl-3 text-xs dark:border-neutral-800">
      <span
        className="grid h-6 w-6 place-items-center rounded-full bg-neutral-200 text-[10px] font-semibold uppercase text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
        title={user.email ?? ""}
      >
        {(user.email ?? "?").charAt(0)}
      </span>
      <span className="hidden text-neutral-700 sm:inline dark:text-neutral-300">{user.email}</span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
