import { useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { listAllProfiles, type Profile } from "../../api/profileApi";

export function AdminUsers() {
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = "Admin · Users · reactimate";
    (async () => {
      const data = await listAllProfiles();
      setRows(data);
      setLoading(false);
    })();
  }, []);

  const filtered = query.trim()
    ? rows.filter((r) =>
        (r.email ?? "").toLowerCase().includes(query.trim().toLowerCase()),
      )
    : rows;

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Everyone who has signed in via your Supabase Auth providers.
      </p>

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
                <th className="px-4 py-2 font-medium">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
              {filtered.map((u) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
