import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { FONTS } from "../../constants/fonts";

interface CreateComponentDialogProps {
  startIndex: number;
  endIndex: number;
  onClose: () => void;
}

export function CreateComponentDialog({
  startIndex,
  endIndex,
  onClose,
}: CreateComponentDialogProps) {
  const project = useProjectStore((s) => s.project);
  const addComponent = useProjectStore((s) => s.addComponent);

  const text = useMemo(
    () => project.layer.text.slice(startIndex, endIndex),
    [project.layer.text, startIndex, endIndex],
  );

  const [fontFamily, setFontFamily] = useState(project.defaultTextStyle.fontFamily);
  const [fontSize, setFontSize] = useState(project.defaultTextStyle.fontSize);
  const [fontWeight, setFontWeight] = useState(project.defaultTextStyle.fontWeight);
  const [color, setColor] = useState(project.defaultTextStyle.color);

  const fontOption = FONTS.find((f) => f.family === fontFamily) ?? FONTS[0];
  const weights = fontOption.weights;
  const safeWeight = weights.includes(fontWeight) ? fontWeight : weights[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const validRange = startIndex >= 0 && endIndex > startIndex;

  const onConfirm = () => {
    if (!validRange) {
      onClose();
      return;
    }
    const id = addComponent(startIndex, endIndex, {
      fontFamily,
      fontSize,
      fontWeight: safeWeight,
      color,
    });
    if (id === null) {
      // Overlap or invalid — store rejected. Silently close; the popover
      // only appears for non-overlapping selections, so this is rare
      // (e.g. selection became stale while the dialog was open).
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Create component
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>

        <div className="px-4 py-3">
          <p className="mb-3 text-xs text-neutral-500">
            Componentize {validRange ? <code className="rounded bg-neutral-100 px-1 py-0.5 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">"{text}"</code> : "the current selection"} so you can give it its own style and effects.
          </p>

          <Row label="Font">
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {FONTS.map((f) => (
                <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                  {f.label}
                </option>
              ))}
            </select>
          </Row>

          <Row label="Weight">
            <select
              value={safeWeight}
              onChange={(e) => setFontWeight(parseInt(e.target.value, 10))}
              className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {weights.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </Row>

          <Row label="Size">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={8}
                max={400}
                value={fontSize}
                onChange={(e) =>
                  setFontSize(Math.max(8, Math.min(400, parseInt(e.target.value, 10) || 0)))
                }
                className="w-20 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              <span className="text-xs text-neutral-500">px</span>
            </div>
          </Row>

          <Row label="Color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={toHexColor(color)}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-8 cursor-pointer rounded border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm font-mono text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                placeholder="#fafafa"
              />
            </div>
          </Row>

          <div className="mt-3 rounded border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-925">
            <span
              style={{
                fontFamily,
                fontSize,
                fontWeight: safeWeight,
                color,
              }}
            >
              {text || "Aa"}
            </span>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-800 hover:border-neutral-500 hover:text-neutral-950 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!validRange}
            className="rounded bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-400 disabled:opacity-50"
          >
            Componentize
          </button>
        </footer>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </label>
  );
}

/** Try to coerce any CSS color to `#rrggbb` so the <input type=color> shows it. */
function toHexColor(input: string): string {
  // Already hex?
  if (/^#[0-9a-f]{6}$/i.test(input.trim())) return input.trim();
  // Use a temporary element to let the browser parse arbitrary CSS color strings.
  if (typeof document === "undefined") return "#fafafa";
  const el = document.createElement("div");
  el.style.color = input;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return "#fafafa";
  const hex = (n: string) => parseInt(n, 10).toString(16).padStart(2, "0");
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}
