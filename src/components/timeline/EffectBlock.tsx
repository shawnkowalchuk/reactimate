import { useRef } from "react";
import type { Component, Effect } from "../../types/project";
import { useDragGesture } from "../../utils/dragGesture";
import { useProjectStore } from "../../store/projectStore";
import { useSelectionStore } from "../../store/selectionStore";
import { EFFECT_LABELS } from "../../constants/effects";
import { clamp, MIN_EFFECT_DURATION, snap, SNAP_SECONDS } from "./timelineMath";

interface EffectBlockProps {
  component: Component;
  effect: Effect;
  pxPerSecond: number;
  duration: number;
}

type DragMode = "move" | "resize-left" | "resize-right";

interface DragInitial {
  startTime: number;
  duration: number;
}

export function EffectBlock({
  component,
  effect,
  pxPerSecond,
  duration,
}: EffectBlockProps) {
  const updateEffect = useProjectStore((s) => s.updateEffect);
  const selectionTarget = useSelectionStore((s) => s.target);
  const selectEffect = useSelectionStore((s) => s.selectEffect);

  const isSelected =
    selectionTarget.kind === "effect" && selectionTarget.effectId === effect.id;

  // One initial-snapshot ref per pointer interaction, plus the active mode.
  const initialRef = useRef<DragInitial | null>(null);

  const applyDelta = (mode: DragMode, dx: number, shiftHeld: boolean) => {
    const initial = initialRef.current;
    if (!initial) return;
    const dt = dx / Math.max(0.0001, pxPerSecond);
    const snapStep = shiftHeld ? 0 : SNAP_SECONDS;

    if (mode === "move") {
      const newStart = clamp(
        snap(initial.startTime + dt, snapStep),
        0,
        duration - initial.duration,
      );
      updateEffect(component.id, effect.id, { startTime: newStart });
    } else if (mode === "resize-left") {
      const desiredStart = clamp(
        snap(initial.startTime + dt, snapStep),
        0,
        initial.startTime + initial.duration - MIN_EFFECT_DURATION,
      );
      const newDuration = initial.startTime + initial.duration - desiredStart;
      updateEffect(component.id, effect.id, {
        startTime: desiredStart,
        duration: newDuration,
      });
    } else {
      const desiredEnd = clamp(
        snap(initial.startTime + initial.duration + dt, snapStep),
        initial.startTime + MIN_EFFECT_DURATION,
        duration,
      );
      updateEffect(component.id, effect.id, {
        duration: desiredEnd - initial.startTime,
      });
    }
  };

  const startDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    initialRef.current = {
      startTime: effect.startTime,
      duration: effect.duration,
    };
    selectEffect(component.id, effect.id);
  };
  const endDrag = () => {
    initialRef.current = null;
  };

  const bodyDrag = useDragGesture({
    onStart: startDrag,
    onMove: (dx, _dy, ev) => applyDelta("move", dx, ev.shiftKey),
    onEnd: endDrag,
  });
  const leftDrag = useDragGesture({
    onStart: startDrag,
    onMove: (dx, _dy, ev) => applyDelta("resize-left", dx, ev.shiftKey),
    onEnd: endDrag,
  });
  const rightDrag = useDragGesture({
    onStart: startDrag,
    onMove: (dx, _dy, ev) => applyDelta("resize-right", dx, ev.shiftKey),
    onEnd: endDrag,
  });

  const left = effect.startTime * pxPerSecond;
  const width = Math.max(2, effect.duration * pxPerSecond);

  return (
    <div
      onPointerDown={bodyDrag}
      role="button"
      tabIndex={0}
      title={`${EFFECT_LABELS[effect.type]} · ${effect.startTime.toFixed(2)}s → ${(
        effect.startTime + effect.duration
      ).toFixed(2)}s`}
      className={`absolute top-1 flex h-[calc(100%-8px)] cursor-grab items-center overflow-hidden rounded text-[11px] font-medium text-neutral-900 active:cursor-grabbing ${
        isSelected ? "ring-2 ring-sky-300" : "ring-1 ring-black/30"
      }`}
      style={{
        left,
        width,
        background: component.color,
      }}
    >
      <span className="pointer-events-none flex-1 truncate px-2">
        {EFFECT_LABELS[effect.type]}
      </span>
      <div
        onPointerDown={leftDrag}
        className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-black/20 hover:bg-black/40"
        title="Resize start"
      />
      <div
        onPointerDown={rightDrag}
        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-black/20 hover:bg-black/40"
        title="Resize end"
      />
    </div>
  );
}
