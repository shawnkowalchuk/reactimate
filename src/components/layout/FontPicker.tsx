import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CATEGORY_LABEL, FONTS, type FontOption } from "../../constants/fonts";

interface FontPickerProps {
  value: string;
  onChange: (family: string) => void;
}

export function FontPicker({ value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // When opened, scroll the active option into view.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const current: FontOption =
    FONTS.find((f) => f.family === value) ?? FONTS[0];

  // Group options by category for visual scanning.
  const grouped = FONTS.reduce<Record<FontOption["category"], FontOption[]>>(
    (acc, f) => {
      (acc[f.category] ??= []).push(f);
      return acc;
    },
    {} as Record<FontOption["category"], FontOption[]>,
  );
  const categoryOrder: FontOption["category"][] = [
    "sans",
    "serif",
    "display",
    "handwriting",
    "mono",
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-neutral-900 hover:border-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        <span style={{ fontFamily: current.family }}>{current.label}</span>
        <ChevronDown size={12} className="text-neutral-400" />
      </button>
      {open && (
        <div
          ref={listRef}
          className="absolute left-0 top-full z-50 mt-1 max-h-80 w-64 overflow-y-auto rounded border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
        >
          {categoryOrder.map((cat) => {
            const items = grouped[cat] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-600">
                  {CATEGORY_LABEL[cat]}
                </div>
                {items.map((f) => {
                  const isActive = f.family === value;
                  return (
                    <button
                      key={f.family}
                      type="button"
                      data-active={isActive ? "true" : undefined}
                      onClick={() => {
                        onChange(f.family);
                        setOpen(false);
                      }}
                      className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                        isActive
                          ? "bg-sky-50 text-sky-900 dark:bg-sky-900/30 dark:text-sky-100"
                          : "text-neutral-900 dark:text-neutral-100"
                      }`}
                      style={{ fontFamily: f.family }}
                    >
                      <span className="text-base leading-tight">{f.label}</span>
                      <span className="shrink-0 text-base leading-tight text-neutral-400 dark:text-neutral-500">
                        Aa
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
