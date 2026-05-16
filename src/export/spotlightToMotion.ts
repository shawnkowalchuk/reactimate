import type { Component, Effect } from "../types/project";

/** Build the spotlight backdrop CSS `background` value (matches the
 *  editor's SpotlightOverlay logic — solid color if feather is 0,
 *  radial-gradient with a fade otherwise). */
function backdropBackground(
  cfg: NonNullable<Effect["spotlight"]>,
): string {
  const { shape, size, color, featherPx = 0 } = cfg;
  const isCircle = shape === "circle";
  const featherFrac = Math.max(0, Math.min(1, featherPx / Math.max(1, size)));
  const innerStop = Math.max(0, 1 - featherFrac) * 100;
  if (featherFrac <= 0) return color;
  return isCircle
    ? `radial-gradient(circle at center, ${color} ${innerStop}%, transparent 100%)`
    : `radial-gradient(farthest-side at center, ${color} ${innerStop}%, transparent 100%)`;
}

export function spotlightEffectsIn(components: Component[]): Effect[] {
  const out: Effect[] = [];
  for (const c of components) {
    for (const e of c.effects) {
      if (e.type === "spotlight" && e.spotlight) out.push(e);
    }
  }
  return out;
}

/**
 * Build the JSX + helpers needed to render spotlight effects in the
 * exported Hero. Returns:
 *  - extraImports: lines to prepend if mouse-mode spotlight is present
 *  - helperComponent: <MouseSpotlight> source (omitted if no mouse mode)
 *  - layerJsx: one JSX block per spotlight effect
 *
 * What's supported in the export:
 *  - Motion modes: mouse, sweep-left, sweep-right (matches preview)
 *  - Backdrop with shape (circle / square), size, color, opacity, feather
 *  - sweepY for sweep modes
 *  - showBackdrop toggle (false → no JSX emitted for that effect)
 *
 * What's NOT supported yet (emits a `{/* … *\/}` comment):
 *  - maskText (tint or reveal). The runtime version recolors / cuts out
 *    the underlying text where the spotlight intersects — it needs a CSS
 *    mask-image driven by the spotlight position, plus text duplication
 *    for tint mode. Separate ticket.
 */
export function buildSpotlightExport(
  components: Component[],
  canvasWidth: number,
  canvasHeight: number,
): {
  extraImports: string[];
  helperComponent: string | null;
  layerJsx: string[];
} | null {
  const fxs = spotlightEffectsIn(components);
  if (fxs.length === 0) return null;

  const hasMouse = fxs.some((e) => e.spotlight!.motion === "mouse");

  const extraImports = hasMouse
    ? [`import { useEffect, useRef, useState } from "react";`]
    : [];

  const helperComponent = hasMouse
    ? `// Tracks the cursor over the hero wrapper and renders a colored
// shape behind the text. Coordinates are normalized to the canvas
// design space via the wrapper getBoundingClientRect ratio, so the
// spotlight position stays correct even when the consumer site
// responsively scales the hero.
function MouseSpotlight({ cfg, canvasWidth, canvasHeight, background }) {
  const wrapRef = useRef(null);
  const [pos, setPos] = useState({ x: canvasWidth / 2, y: canvasHeight / 2 });
  useEffect(() => {
    const onMove = (e) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      if (!rect.width) return;
      const sx = canvasWidth / rect.width;
      const sy = canvasHeight / rect.height;
      setPos({
        x: (e.clientX - rect.left) * sx,
        y: (e.clientY - rect.top) * sy,
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [canvasWidth, canvasHeight]);
  const w = cfg.size * 2;
  const h = cfg.size * 2;
  return (
    <div
      ref={wrapRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          left: pos.x - cfg.size,
          top: pos.y - cfg.size,
          width: w,
          height: h,
          background,
          opacity: cfg.opacity,
          borderRadius: cfg.shape === "circle" ? "50%" : 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}`
    : null;

  const layerJsx: string[] = [];
  for (const e of fxs) {
    const cfg = e.spotlight!;
    if (cfg.maskText) {
      layerJsx.push(
        `{/* Spotlight ${e.id} maskText=${cfg.maskMode ?? "tint"} is not exported yet — only the backdrop is rendered. The text-cutout / tint effect requires a CSS mask helper that's still on the backlog. */}`,
      );
    }
    if (cfg.showBackdrop === false) {
      layerJsx.push(`{/* Spotlight ${e.id} backdrop disabled (showBackdrop: false). */}`);
      continue;
    }
    const background = backdropBackground(cfg);
    const w = cfg.size * 2;
    const h = cfg.size * 2;

    if (cfg.motion === "mouse") {
      // Bake just what the helper needs — drop the maskText fields since
      // they're not exported yet.
      const helperCfg = {
        shape: cfg.shape,
        size: cfg.size,
        color: cfg.color,
        opacity: cfg.opacity,
      };
      layerJsx.push(`{/* Spotlight ${e.id} mouse-driven backdrop */}
<MouseSpotlight
  cfg={${JSON.stringify(helperCfg)}}
  canvasWidth={${canvasWidth}}
  canvasHeight={${canvasHeight}}
  background={${JSON.stringify(background)}}
/>`);
      continue;
    }

    // Sweep modes — linear animation across the canvas over the effect's
    // [startTime, startTime + duration] window. Uses explicit sweepStart
    // / sweepEnd when set; otherwise falls back to the mode-based
    // off-canvas defaults (matches the preview's t01 lerp).
    const isLeft = cfg.motion === "sweep-left";
    const defaultY = cfg.sweepY ?? canvasHeight / 2;
    const start = cfg.sweepStart ?? {
      x: isLeft ? -cfg.size : canvasWidth + cfg.size,
      y: defaultY,
    };
    const end = cfg.sweepEnd ?? {
      x: isLeft ? canvasWidth + cfg.size : -cfg.size,
      y: defaultY,
    };
    // motion.div's x/y animate from the inline left/top origin (0, 0).
    // Subtract half-size so each (x, y) keyframe puts the shape's CENTER
    // at that design coord.
    const startX = start.x - w / 2;
    const startY = start.y - h / 2;
    const endX = end.x - w / 2;
    const endY = end.y - h / 2;

    layerJsx.push(`{/* Spotlight ${e.id} ${cfg.motion} backdrop */}
<motion.div
  initial={{ x: ${startX}, y: ${startY} }}
  animate={{ x: ${endX}, y: ${endY} }}
  transition={{ delay: ${e.startTime}, duration: ${e.duration}, ease: "linear" }}
  style={{
    position: "absolute",
    left: 0,
    top: 0,
    width: ${w},
    height: ${h},
    background: ${JSON.stringify(background)},
    opacity: ${cfg.opacity},
    borderRadius: ${cfg.shape === "circle" ? '"50%"' : "0"},
    pointerEvents: "none",
  }}
/>`);
  }

  return { extraImports, helperComponent, layerJsx };
}
