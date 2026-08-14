import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Download, ExternalLink, FileText } from "lucide-react";
import type { AdminProjectRow } from "../../api/projectApi";
import { summarizeProject } from "./summarizeProject";
import { saveProjectFile } from "../../persistence/importExport";
import { useProjectStore } from "../../store/projectStore";
import { markSkipCloudSync } from "../../persistence/useCloudSync";
import { EFFECT_LABELS } from "../../constants/effects";

interface Props {
  email: string | null;
  row: AdminProjectRow;
  onClose: () => void;
}

/**
 * Read-only inspector for another user's cloud project.
 *
 * Deliberately NOT an impersonation tool: it reads the project doc the admin
 * rules already expose and never writes to it. "Open in editor" loads a COPY
 * into the local editor behind `markSkipCloudSync()`, so autosave can't push
 * it to either account — the admin's own cloud project stays untouched until
 * they explicitly Save, and the viewed user's is never written at all.
 */
export function UserProjectDialog({ email, row, onClose }: Props) {
  const navigate = useNavigate();
  const setProject = useProjectStore((s) => s.setProject);
  const s = summarizeProject(row.data);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const openInEditor = () => {
    markSkipCloudSync();
    setProject(row.data);
    navigate("/app");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="User project"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileText size={15} className="text-neutral-500" />
            {s.name || "Untitled project"}
          </h2>
          <p className="mt-1 font-mono text-xs text-neutral-500">
            {email ?? row.user_id}
          </p>
        </header>

        <div className="space-y-4 px-5 py-4">
          {s.looksUntouched && (
            <p className="rounded border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              Still matches the bundled sample — saved by autosave, but the text
              and components were never changed.
            </p>
          )}

          <div>
            <div className="text-[11px] uppercase tracking-wider text-neutral-500">
              Hero text
            </div>
            <p className="mt-1 break-words rounded bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900">
              {s.text || <span className="text-neutral-500">(empty)</span>}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Row label="Components" value={String(s.componentCount)} />
            <Row label="Effects" value={String(s.effectCount)} />
            <Row label="Duration" value={`${s.durationSeconds}s`} />
            <Row label="Canvas" value={s.canvas} />
            <Row
              label="Last saved"
              value={
                row.updated_at
                  ? new Date(row.updated_at).toLocaleString()
                  : "—"
              }
            />
            <Row label="Characters" value={String(s.textLength)} />
          </dl>

          {s.effectTypes.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                Effects used
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {s.effectTypes.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
                  >
                    {EFFECT_LABELS[t] ?? t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => saveProjectFile(row.data)}
            className="inline-flex items-center gap-1.5 rounded border border-neutral-300 px-3 py-1.5 text-xs hover:border-neutral-500 dark:border-neutral-700"
          >
            <Download size={12} />
            Download .json
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-neutral-300 px-3 py-1.5 text-xs hover:border-neutral-500 dark:border-neutral-700"
            >
              Close
            </button>
            <button
              type="button"
              onClick={openInEditor}
              title="Loads a copy locally — their project is never written to"
              className="inline-flex items-center gap-1.5 rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <ExternalLink size={12} />
              Open a copy in the editor
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-neutral-500">
        {label}
      </dt>
      <dd className="tabular-nums text-neutral-800 dark:text-neutral-200">
        {value}
      </dd>
    </div>
  );
}
