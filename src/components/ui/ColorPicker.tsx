import { useEffect, useRef, useState } from "react";
import { Pipette } from "lucide-react";

/**
 * Default palette — a balanced mix of neutrals and saturated brand
 * colors. Swatch values are hex so they round-trip cleanly to the
 * native `input[type=color]` fallback at the bottom.
 */
const DEFAULT_SWATCHES: readonly string[] = [
  // Row 1 — neutrals
  "#ffffff",
  "#fafafa",
  "#e5e5e5",
  "#a3a3a3",
  "#525252",
  "#262626",
  "#0a0a0a",
  "#000000",
  // Row 2 — warm
  "#fee2e2",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#fbbf24",
  "#d97706",
  // Row 3 — green/teal/blue
  "#bbf7d0",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#1d4ed8",
  // Row 4 — purple/pink
  "#dbeafe",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#7f1d1d",
];

interface ColorPickerProps {
  value: string;
  onChange: (v: string) => void;
  /** Override the swatch palette. */
  swatches?: readonly string[];
  /** Extra classes for the trigger button. */
  className?: string;
  /** Optional aria-label / tooltip on the trigger. */
  title?: string;
  /** Render the trigger inline within a flex row; defaults to a 24px square. */
  size?: "sm" | "md";
}

/**
 * Swatch-based color picker with a popover. Click the trigger to open
 * a grid of preset colors; pick one to set the value. The popover
 * also includes a free-form CSS-color text input and a native
 * `<input type="color">` button as a custom-color fallback.
 */
export function ColorPicker({
  value,
  onChange,
  swatches = DEFAULT_SWATCHES,
  className = "",
  title,
  size = "sm",
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDocPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDocPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const norm = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();

  const dim = size === "sm" ? "h-5 w-7" : "h-7 w-9";

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title ?? value}
        aria-label={title ?? "Pick color"}
        className={`${dim} cursor-pointer rounded border border-neutral-300 transition-shadow hover:ring-2 hover:ring-neutral-300/60 dark:border-neutral-700 dark:hover:ring-neutral-700/60`}
        style={{ background: value }}
      />
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-full z-40 mt-1 w-[244px] rounded-lg border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-8 gap-1.5">
            {swatches.map((c) => {
              const selected = norm(c, value);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  title={c}
                  aria-label={c}
                  className={`h-6 w-6 rounded border transition-transform hover:scale-110 ${
                    selected
                      ? "border-sky-500 ring-2 ring-sky-400/50"
                      : "border-neutral-300 dark:border-neutral-700"
                  }`}
                  style={{ background: c }}
                />
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            <label
              className="grid h-7 w-9 cursor-pointer place-items-center rounded border border-neutral-300 text-neutral-500 hover:text-neutral-700 dark:border-neutral-700 dark:hover:text-neutral-200"
              title="Custom color"
            >
              <Pipette size={14} />
              <input
                type="color"
                value={toHex(value)}
                onChange={(e) => onChange(e.target.value)}
                className="absolute h-0 w-0 cursor-pointer opacity-0"
                tabIndex={-1}
                aria-label="Custom color"
              />
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#hex / rgb / hsl"
              className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 font-mono text-[11px] text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Coerce arbitrary CSS color → `#rrggbb` for the native picker. */
function toHex(input: string): string {
  if (/^#[0-9a-f]{6}$/i.test(input.trim())) return input.trim();
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
