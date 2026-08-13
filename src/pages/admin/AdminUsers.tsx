import { useEffect, useState } from "react";
import { Loader2, Shield, Trash2, TriangleAlert } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { listAllProfiles, type Profile } from "../../api/profileApi";
import {
  purgeUserData,
  removalBlockedReason,
  type PurgeResult,
} from "../../api/adminUserApi";
import { auth } from "../../auth/firebase";
import { formatDuration } from "./formatDuration";

export function AdminUsers() {
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  /** The profile awaiting delete confirmation, if any. */
  const [confirming, setConfirming] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Admin · Users · reactimate";
    (async () => {
      const data = await listAllProfiles();
      setRows(data);
      setLoading(false);
    })();
  }, []);

  const currentUid = auth?.currentUser?.uid ?? null;

  const filtered = query.trim()
    ? rows.filter((r) =>
        (r.email ?? "").toLowerCase().includes(query.trim().toLowerCase()),
      )
    : rows;

  const onConfirmRemove = async () => {
    if (!confirming) return;
    setBusy(true);
    setError(null);
    try {
      const result = await purgeUserData(confirming.id, confirming);
      setRows((prev) => prev.filter((r) => r.id !== confirming.id));
      setNotice(
        `Removed ${confirming.email ?? confirming.id} — ${summarize(result)}. ` +
          `Their sign-in still exists; delete it in Firebase console → Authentication to lock them out.`,
      );
      setConfirming(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Removal failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Everyone who has signed in via your Firebase Auth providers.
      </p>

      {notice && (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200">
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-2 underline hover:no-underline"
          >
            dismiss
          </button>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Search by email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-64 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
        />
        <span className="text-xs text-neutral-500">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No users match.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wider text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 font-medium">Last seen</th>
                <th className="px-4 py-2 font-medium">Time in app</th>
                <th className="px-4 py-2 font-medium">Admin</th>
                <th className="px-4 py-2 font-medium sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
              {filtered.map((u) => {
                const blocked = removalBlockedReason(u, currentUid);
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-2 font-mono text-xs">
                      {u.email ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">
                      {u.last_seen_at
                        ? new Date(u.last_seen_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs tabular-nums text-neutral-500">
                      {u.active_seconds > 0
                        ? formatDuration(u.active_seconds)
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {u.is_admin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                          <Shield size={10} />
                          admin
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        disabled={blocked !== null}
                        onClick={() => {
                          setError(null);
                          setConfirming(u);
                        }}
                        title={blocked ?? `Remove ${u.email ?? u.id}`}
                        aria-label={`Remove ${u.email ?? u.id}`}
                        className="rounded p-1 text-neutral-400 enabled:hover:bg-red-50 enabled:hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:enabled:hover:bg-red-950/40 dark:enabled:hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirming && (
        <ConfirmRemoveDialog
          profile={confirming}
          busy={busy}
          error={error}
          onCancel={() => {
            setConfirming(null);
            setError(null);
          }}
          onConfirm={onConfirmRemove}
        />
      )}
    </AdminLayout>
  );
}

function summarize(r: PurgeResult): string {
  const parts = [
    r.projectDeleted ? "project" : null,
    r.presets > 0 ? `${r.presets} preset${r.presets === 1 ? "" : "s"}` : null,
    r.feedback > 0
      ? `${r.feedback} feedback thread${r.feedback === 1 ? "" : "s"}`
      : null,
    r.replies > 0 ? `${r.replies} repl${r.replies === 1 ? "y" : "ies"}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `deleted ${parts.join(", ")}` : "no data to delete";
}

interface ConfirmProps {
  profile: Profile;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Blocking confirm for an irreversible purge. Deliberately NOT the shared
 * `layout/Modal` — that one is sized for the editor's left half
 * (`w-1/2`, left-anchored) and would render off-centre on an admin page.
 */
function ConfirmRemoveDialog({
  profile,
  busy,
  error,
  onCancel,
  onConfirm,
}: ConfirmProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4"
      onMouseDown={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm user removal"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 py-4">
          <TriangleAlert
            size={18}
            className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
          />
          <div>
            <h2 className="text-sm font-semibold">Remove this user?</h2>
            <p className="mt-1 font-mono text-xs text-neutral-600 dark:text-neutral-400">
              {profile.email ?? profile.id}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              Permanently deletes their cloud project, saved presets, and
              feedback threads. This can't be undone.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              Their sign-in is <strong>not</strong> deleted — that needs the
              server-side Admin SDK. If they sign in again they'll get a fresh
              empty account. To lock them out, delete the user in Firebase
              console → Authentication.
            </p>
            {error && (
              <p className="mt-3 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-neutral-300 px-3 py-1.5 text-xs hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={12} className="animate-spin" />}
            {busy ? "Removing…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
