import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { Component, EffectType } from "../../types/project";
import { useProjectStore } from "../../store/projectStore";
import { usePlaybackStore } from "../../store/playbackStore";
import { useSelectionStore } from "../../store/selectionStore";
import { EFFECT_DEFAULTS, EFFECT_LABELS } from "../../constants/effects";

const TYPES: EffectType[] = ["fade", "slide", "scale", "rotate", "color-shift"];

interface AddEffectMenuProps {
  component: Component;
  projectDuration: number;
}

export function AddEffectMenu({ component, projectDuration }: AddEffectMenuProps) {
  const addEffect = useProjectStore((s) => s.addEffect);
  const selectEffect = useSelectionStore((s) => s.selectEffect);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onPick = (type: EffectType) => {
    const defaults = EFFECT_DEFAULTS[type];
    const requested = usePlaybackStore.getState().currentTime;
    const maxStart = Math.max(0, projectDuration - defaults.duration);
    const startTime = Math.min(Math.max(0, requested), maxStart);
    const id = addEffect(component.id, type, startTime);
    setOpen(false);
    if (id) selectEffect(component.id, id);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Add effect"
        aria-label="Add effect"
        className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
      >
        <Plus size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onPick(t)}
              className="block w-full px-3 py-1.5 text-left text-xs text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {EFFECT_LABELS[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
