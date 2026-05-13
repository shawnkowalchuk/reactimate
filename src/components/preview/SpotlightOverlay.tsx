import { useEffect, type RefObject } from "react";
import { useProjectStore } from "../../store/projectStore";
import { usePlaybackStore } from "../../store/playbackStore";
import { useSpotlightStore } from "../../store/spotlightStore";
import type { Effect } from "../../types/project";

interface Props {
  /** The scaled canvas frame (the inner div with `transform: scale(...)`). */
  frameRef: RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
}

/**
 * Renders any active "spotlight" effect as a colored shape behind the
 * text in the preview canvas.
 *
 * Three motion modes:
 *  - "mouse"        : tracks the cursor position over the canvas
 *  - "sweep-left"   : moves left → right linearly across canvas during the effect
 *  - "sweep-right"  : moves right → left linearly across canvas during the effect
 *
 * Position is in canvas-design coordinates (the same coord space as the
 * canvas's width/height), positioned via absolute left/top inside the
 * scaled frame so it inherits the frame's transform.
 */
export function SpotlightOverlay({
  frameRef,
  canvasWidth,
  canvasHeight,
  scale,
}: Props) {
  const components = useProjectStore((s) => s.project.layer.components);
  const time = usePlaybackStore((s) => s.currentTime);
  const mouseDesign = useSpotlightStore((s) => s.mouse);
  const setMouseDesign = useSpotlightStore((s) => s.setMouse);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onMove = (e: PointerEvent) => {
      const rect = frame.getBoundingClientRect();
      // Real viewport-to-design scale = visible frame width / design width.
      // The `scale` prop reflects the inline transform value, but the
      // frame may also be flex-shrunken below its declared width before
      // that transform is applied — so we recover the actual ratio from
      // the bounding rect, matching what SparkleOverlay/TintLayer use.
      const designWidth = parseFloat(frame.style.width || "0") || rect.width;
      const realScale = designWidth > 0 ? rect.width / designWidth : 1;
      const safeScale = Math.max(0.0001, realScale);
      const x = (e.clientX - rect.left) / safeScale;
      const y = (e.clientY - rect.top) / safeScale;
      setMouseDesign({ x, y });
    };
    frame.addEventListener("pointermove", onMove);
    return () => {
      frame.removeEventListener("pointermove", onMove);
    };
  }, [frameRef, scale, setMouseDesign]);

  // Collect every active spotlight effect across all components.
  const active: Array<{ key: string; cfg: NonNullable<Effect["spotlight"]>; t01: number }> = [];
  for (const c of components) {
    for (const e of c.effects) {
      if (e.type !== "spotlight" || !e.spotlight) continue;
      const end = e.startTime + e.duration;
      if (time < e.startTime || time > end) continue;
      const t01 = e.duration <= 0 ? 1 : (time - e.startTime) / e.duration;
      active.push({ key: `${c.id}_${e.id}`, cfg: e.spotlight, t01 });
    }
  }

  if (active.length === 0) return null;

  const fallback = { x: canvasWidth / 2, y: canvasHeight / 2 };
  const mouse = mouseDesign ?? fallback;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {active.map(({ key, cfg, t01 }) => {
        if (cfg.showBackdrop === false) return null;
        const { shape, size, color, opacity, motion, featherPx = 0 } = cfg;
        // Compute position in design coords based on motion mode.
        let cx: number;
        let cy: number;
        if (motion === "mouse") {
          cx = mouse.x;
          cy = mouse.y;
        } else if (motion === "sweep-left") {
          // Enter from off-screen left, exit off-screen right.
          cx = -size + (canvasWidth + size * 2) * t01;
          cy = canvasHeight / 2;
        } else {
          // sweep-right: enter from off-screen right, exit off-screen left.
          cx = canvasWidth + size - (canvasWidth + size * 2) * t01;
          cy = canvasHeight / 2;
        }
        const isCircle = shape === "circle";
        const w = size * 2;
        const h = size * 2;
        // Soft edges via a radial-gradient that fades from solid color
        // at center to transparent at the edge. Feather percentage =
        // featherPx / size: 0 = hard edge, larger = softer falloff.
        // This avoids `filter: blur` which bleeds outside the box and
        // creates artifacts on the surrounding text.
        const featherFrac = Math.max(
          0,
          Math.min(1, featherPx / Math.max(1, size)),
        );
        const innerStop = Math.max(0, 1 - featherFrac) * 100;
        let background: string;
        if (isCircle) {
          background =
            featherFrac > 0
              ? `radial-gradient(circle at center, ${color} ${innerStop}%, transparent 100%)`
              : color;
        } else {
          // Square with soft edges: use a radial-gradient with farthest-side
          // so the falloff reaches the box edges (not corners). At 0 feather
          // it stays a solid square.
          background =
            featherFrac > 0
              ? `radial-gradient(farthest-side at center, ${color} ${innerStop}%, transparent 100%)`
              : color;
        }
        return (
          <div
            key={key}
            style={{
              position: "absolute",
              left: cx - w / 2,
              top: cy - h / 2,
              width: w,
              height: h,
              background,
              opacity,
              borderRadius: isCircle ? "50%" : 0,
              willChange: "left, top",
            }}
          />
        );
      })}
    </div>
  );
}
