import { LogOut } from "lucide-react";
import { isAuthEnabled } from "../../auth/supabase";
import { signOut, useAuth } from "../../auth/useAuth";

export function UserMenu() {
  const { user } = useAuth();

  if (!isAuthEnabled || !user) return null;

  return (
    <div className="flex items-center gap-2 border-l border-neutral-800 pl-3 text-xs">
      <span
        className="grid h-6 w-6 place-items-center rounded-full bg-neutral-800 text-[10px] font-semibold uppercase text-neutral-200"
        title={user.email ?? ""}
      >
        {(user.email ?? "?").charAt(0)}
      </span>
      <span className="hidden text-neutral-300 sm:inline">{user.email}</span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
