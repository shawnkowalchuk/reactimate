import type { Component, Effect } from "../types/project";

/**
 * Source for the <MaskedText> helper component. Wraps a text node so a
 * spotlight beam can recolor or cut it out, matching the editor preview's
 * tint and reveal modes.
 *
 * How positioning works:
 *  - clip-path: circle(R at X Y) clips a DOM element to a circle whose
 *    (X, Y) are in the element's OWN box coordinates (CSS px, top-left
 *    origin). The spotlight position from the editor is in canvas-design
 *    coordinates.
 *  - On mount we measure the text's offset from the nearest ancestor that
 *    has the project's canvas width. Divide by the live canvas-to-viewport
 *    scale to get the text's design-coord offset within the canvas. Then
 *    spotlight_local = spotlight_canvas - text_offset_canvas.
 *  - Mouse mode: pointermove updates the local (X, Y) state directly.
 *  - Sweep mode: motion animates the clip-path string between the start
 *    and end design coordinates (also offset-corrected).
 *
 * Tint mode renders the original text untouched, then layers a tinted
 * copy on top with the same clip-path so only the beam area is
 * recolored. Reveal mode clips the original directly so the text is
 * visible only inside the beam.
 */
const MASKED_TEXT_SOURCE = `function MaskedText({ cfg, canvasWidth, startTime, duration, baseStyle, tintColor, mode, sweepStart, sweepEnd, children }) {
  const wrapRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0, ready: false });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Walk up to the closest ancestor whose CSS width matches the canvas.
    let canvas = el.parentElement;
    while (canvas) {
      const w = canvas.getBoundingClientRect().width;
      if (Math.abs(w - canvasWidth) < 0.5 || Math.abs(parseFloat(getComputedStyle(canvas).width) - canvasWidth) < 0.5) break;
      canvas = canvas.parentElement;
    }
    if (!canvas) return;
    const wRect = canvas.getBoundingClientRect();
    const tRect = el.getBoundingClientRect();
    const scale = wRect.width / canvasWidth;
    setOffset({
      x: (tRect.left - wRect.left) / Math.max(0.0001, scale),
      y: (tRect.top - wRect.top) / Math.max(0.0001, scale),
      ready: true,
    });
  }, [canvasWidth, children]);

  useEffect(() => {
    if (cfg.motion !== "mouse") return;
    const onMove = (e) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [cfg.motion]);

  const clipFor = (cx, cy) => {
    if (cfg.shape === "square") {
      const top = cy - cfg.size;
      const right = -(cx + cfg.size);
      const bottom = -(cy + cfg.size);
      const left = cx - cfg.size;
      return "inset(" + top + "px " + right + "px " + bottom + "px " + left + "px)";
    }
    return "circle(" + cfg.size + "px at " + cx + "px " + cy + "px)";
  };

  // Mouse mode: clipPath is driven by state (no motion keyframes).
  const isMouse = cfg.motion === "mouse";
  const sweepStartLocal = sweepStart && offset.ready
    ? clipFor(sweepStart.x - offset.x, sweepStart.y - offset.y)
    : null;
  const sweepEndLocal = sweepEnd && offset.ready
    ? clipFor(sweepEnd.x - offset.x, sweepEnd.y - offset.y)
    : null;
  const mouseClip = isMouse ? clipFor(mousePos.x, mousePos.y) : null;

  // The masked layer style: clipped + tinted (tint) or just clipped (reveal).
  const maskedStyle = Object.assign({}, baseStyle, {
    position: "absolute",
    top: 0,
    left: 0,
    pointerEvents: "none",
    color: mode === "tint" ? tintColor : baseStyle.color,
  });

  const sweepTransition = { delay: startTime, duration: duration, ease: "linear" };

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      {mode === "tint" ? children : null}
      {isMouse ? (
        <span style={Object.assign({}, maskedStyle, { clipPath: mouseClip, WebkitClipPath: mouseClip })}>
          {children}
        </span>
      ) : (sweepStartLocal && sweepEndLocal) ? (
        <motion.span
          style={maskedStyle}
          initial={{ clipPath: sweepStartLocal, WebkitClipPath: sweepStartLocal }}
          animate={{ clipPath: sweepEndLocal, WebkitClipPath: sweepEndLocal }}
          transition={sweepTransition}
        >
          {children}
        </motion.span>
      ) : null}
      {mode === "reveal" && !isMouse && !sweepStartLocal ? children : null}
    </span>
  );
}`;

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

/** Find the first maskText spotlight effect on a component, if any. */
export function maskTextSpotlightOf(c: Component): Effect | undefined {
  for (const e of c.effects) {
    if (e.type === "spotlight" && e.spotlight?.maskText) return e;
  }
  return undefined;
}

/** True iff any component has a maskText spotlight. */
export function hasMaskTextSpotlight(components: Component[]): boolean {
  for (const c of components) {
    if (maskTextSpotlightOf(c)) return true;
  }
  return false;
}

/**
 * Compute the canvas-design coordinates of a sweep spotlight's start /
 * end positions, falling back to the mode-based defaults when sweepStart
 * / sweepEnd aren't explicitly set. Returns null when the spotlight uses
 * mouse motion (which has no static start/end).
 */
export function sweepStartEnd(
  cfg: NonNullable<Effect["spotlight"]>,
  canvasWidth: number,
  canvasHeight: number,
): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
  if (cfg.motion === "mouse") return null;
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
  return { start, end };
}

/** Export the MaskedText component source for inclusion in the file. */
export function maskedTextHelperSource(): string {
  return MASKED_TEXT_SOURCE;
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
    // maskText is now exported via the <MaskedText> helper wired into
    // the text spans in generateComponent.ts — no inline comment needed.
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
