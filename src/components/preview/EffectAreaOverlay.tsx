import { useMemo, useRef } from "react";
import type { Component, EffectArea, Project } from "../../types/project";
import { useProjectStore } from "../../store/projectStore";
import { useDragGesture } from "../../utils/dragGesture";

interface Props {
  project: Project;
  /** Current canvas-to-viewport scale; pointer deltas / scale = design deltas. */
  scale: number;
}

interface AreaTarget {
  componentId: string;
  effectId: string;
  /** "particle" or "fireworks" — controls which patch path runs. */
  kind: "particle" | "fireworks";
  area: EffectArea;
  /** Component color (used to color-code the bbox border / label). */
  color: string;
  /** Short label shown above the bbox: "Particle area" / "Fireworks area". */
  label: string;
}

/**
 * Lists every particle / fireworks effect in the project whose config
 * carries an `area` rectangle. One bbox is drawn per entry.
 */
function collectAreaTargets(project: Project): AreaTarget[] {
  const out: AreaTarget[] = [];
  for (const c of project.layer.components) {
    for (const e of c.effects) {
      if (e.type === "particle" && e.particle?.area) {
        out.push({
          componentId: c.id,
          effectId: e.id,
          kind: "particle",
          area: e.particle.area,
          color: c.color,
          label: "Particle area",
        });
      }
      if (e.type === "fireworks-js" && e.fireworks?.area) {
        out.push({
          componentId: c.id,
          effectId: e.id,
          kind: "fireworks",
          area: e.fireworks.area,
          color: c.color,
          label: "Fireworks area",
        });
      }
    }
  }
  return out;
}

/**
 * Always-visible (while editing) UI overlay drawing one draggable +
 * resizable rectangle per particle / fireworks effect in the project.
 * Coordinates are in canvas-DESIGN space. Pointer-events are scoped:
 *  - the wrapper has `pointer-events: none` so it never blocks below;
 *  - the body / handles set `pointer-events: auto` to capture drags.
 */
export function EffectAreaOverlay({ project, scale }: Props) {
  const targets = useMemo(() => collectAreaTargets(project), [project]);
  if (targets.length === 0) return null;
  return (
    <div
      aria-hidden="false"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {targets.map((t) => (
        <AreaBox key={`${t.componentId}_${t.effectId}`} target={t} scale={scale} />
      ))}
    </div>
  );
}

function AreaBox({ target, scale }: { target: AreaTarget; scale: number }) {
  const updateEffect = useProjectStore((s) => s.updateEffect);

  // Snapshot of the area at pointerdown. All pointermove deltas are applied
  // relative to THIS snapshot, NOT to target.area — which gets replaced on
  // every apply() and would otherwise compound each move into runaway speed.
  const startAreaRef = useRef<EffectArea>(target.area);
  const captureStart = () => {
    startAreaRef.current = { ...target.area };
  };

  const apply = (next: EffectArea) => {
    if (target.kind === "particle") {
      const project = useProjectStore.getState().project;
      const c = project.layer.components.find((x) => x.id === target.componentId);
      const e = c?.effects.find((x) => x.id === target.effectId);
      const cfg = (e as Component["effects"][number] | undefined)?.particle;
      if (!cfg) return;
      updateEffect(target.componentId, target.effectId, {
        particle: { ...cfg, area: next },
      });
    } else {
      const project = useProjectStore.getState().project;
      const c = project.layer.components.find((x) => x.id === target.componentId);
      const e = c?.effects.find((x) => x.id === target.effectId);
      const cfg = (e as Component["effects"][number] | undefined)?.fireworks;
      if (!cfg) return;
      updateEffect(target.componentId, target.effectId, {
        fireworks: { ...cfg, area: next },
      });
    }
  };

  // Drag the body to MOVE — relative to the snapshot.
  const onMoveDown = useDragGesture({
    onStart: captureStart,
    onMove: (dx, dy) => {
      const start = startAreaRef.current;
      apply({
        ...start,
        x: Math.round(start.x + dx / scale),
        y: Math.round(start.y + dy / scale),
      });
    },
  });

  // Drag a corner handle to RESIZE — also relative to the snapshot.
  // Four hooks (one per corner) so React's rules-of-hooks are satisfied
  // (always called in the same order).
  const resizeHandler = (corner: "tl" | "tr" | "bl" | "br") => (
    dx: number,
    dy: number,
  ) => {
    const start = startAreaRef.current;
    const ddx = dx / scale;
    const ddy = dy / scale;
    let { x, y, width, height } = start;
    if (corner === "tl") {
      x += ddx;
      y += ddy;
      width -= ddx;
      height -= ddy;
    } else if (corner === "tr") {
      y += ddy;
      width += ddx;
      height -= ddy;
    } else if (corner === "bl") {
      x += ddx;
      width -= ddx;
      height += ddy;
    } else {
      width += ddx;
      height += ddy;
    }
    const minSize = 40;
    if (width < minSize) width = minSize;
    if (height < minSize) height = minSize;
    apply({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    });
  };

  const onTL = useDragGesture({ onStart: captureStart, onMove: resizeHandler("tl") });
  const onTR = useDragGesture({ onStart: captureStart, onMove: resizeHandler("tr") });
  const onBL = useDragGesture({ onStart: captureStart, onMove: resizeHandler("bl") });
  const onBR = useDragGesture({ onStart: captureStart, onMove: resizeHandler("br") });

  const handleSize = 12 / scale; // keep handles visually constant under transform
  const borderWidth = 2 / scale;

  return (
    <div
      style={{
        position: "absolute",
        left: target.area.x,
        top: target.area.y,
        width: target.area.width,
        height: target.area.height,
        pointerEvents: "auto",
        cursor: "move",
        boxSizing: "border-box",
        border: `${borderWidth}px dashed ${target.color}`,
        background: "transparent",
      }}
      onPointerDown={onMoveDown}
      title={`${target.label} — drag to move, drag corners to resize`}
    >
      <span
        style={{
          position: "absolute",
          top: -22 / scale,
          left: 0,
          fontSize: 11 / scale,
          fontFamily: "ui-monospace, monospace",
          padding: `${2 / scale}px ${6 / scale}px`,
          background: target.color,
          color: "#0a0a0a",
          borderRadius: 3 / scale,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {target.label}
      </span>
      {/* Corner handles — pointerEvents: auto via inline style. */}
      <CornerHandle position="tl" size={handleSize} color={target.color} onPointerDown={onTL} />
      <CornerHandle position="tr" size={handleSize} color={target.color} onPointerDown={onTR} />
      <CornerHandle position="bl" size={handleSize} color={target.color} onPointerDown={onBL} />
      <CornerHandle position="br" size={handleSize} color={target.color} onPointerDown={onBR} />
    </div>
  );
}

function CornerHandle({
  position,
  size,
  color,
  onPointerDown,
}: {
  position: "tl" | "tr" | "bl" | "br";
  size: number;
  color: string;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const cursors: Record<typeof position, string> = {
    tl: "nwse-resize",
    tr: "nesw-resize",
    bl: "nesw-resize",
    br: "nwse-resize",
  };
  const offsets: Record<typeof position, { left?: number; right?: number; top?: number; bottom?: number }> = {
    tl: { left: -size / 2, top: -size / 2 },
    tr: { right: -size / 2, top: -size / 2 },
    bl: { left: -size / 2, bottom: -size / 2 },
    br: { right: -size / 2, bottom: -size / 2 },
  };
  return (
    <span
      onPointerDown={(e) => {
        // Don't bubble — the body's onPointerDown would also fire move.
        e.stopPropagation();
        onPointerDown(e);
      }}
      style={{
        position: "absolute",
        width: size,
        height: size,
        background: color,
        border: `${1 / 2}px solid #0a0a0a`,
        borderRadius: 2,
        cursor: cursors[position],
        pointerEvents: "auto",
        ...offsets[position],
      }}
    />
  );
}
