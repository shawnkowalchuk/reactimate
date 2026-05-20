import type { Component, Effect, EffectArea } from "../types/project";

/** Translate `area` (canvas-design coords) into fireworks-js `boundaries`. */
function areaToBoundaries(area: EffectArea) {
  return {
    x: area.x,
    y: area.y,
    width: area.x * 3 + area.width,
    height: (area.y + area.height) * 2,
  };
}

export function fireworksEffectsIn(components: Component[]): Effect[] {
  const out: Effect[] = [];
  for (const c of components) {
    for (const e of c.effects) {
      if (e.type === "fireworks-js" && e.fireworks) out.push(e);
    }
  }
  return out;
}

/**
 * Build the JSX + helpers needed to render fireworks-js inside the
 * exported Hero. Returns an object with:
 *  - extraImports: import lines to prepend to the file
 *  - helperComponent: the FireworksLayer component definition
 *  - layerJsx: <FireworksLayer cfg={...} /> for each fireworks effect
 *
 * The exported FireworksLayer is self-contained — it mounts a canvas
 * via useEffect, instantiates fireworks-js with the user's settings
 * + area-derived boundaries, and tears down cleanly on unmount.
 */
export function buildFireworksExport(
  components: Component[],
  canvasWidth: number,
  canvasHeight: number,
): {
  extraImports: string[];
  helperComponent: string;
  layerJsx: string[];
} | null {
  const fxs = fireworksEffectsIn(components);
  if (fxs.length === 0) return null;

  const extraImports = [
    `import { useEffect, useRef } from "react";`,
    `import { Fireworks } from "fireworks-js";`,
  ];

  const helperComponent = `// Renders fireworks-js on a canvas overlay sized to the design canvas.
// Pass the entire config; this component handles init / start / dispose.
// Install: npm install fireworks-js
function FireworksLayer({ config, width, height, autoStart = true }) {
  const canvasRef = useRef(null);
  const hitRef = useRef(null);
  const fwRef = useRef(null);

  // Create the fireworks-js instance once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const noAutoFire = config.autoFire === false;
    const interactive = config.followMouse || config.followCursor;
    const fw = new Fireworks(canvas, {
      autoresize: false,
      opacity: config.opacity ?? 0.5,
      acceleration: config.acceleration ?? 1.05,
      friction: config.friction ?? 0.97,
      gravity: config.gravity ?? 1.5,
      particles: config.density ?? 50,
      traceLength: config.traceLength ?? 3,
      traceSpeed: config.traceSpeed ?? 10,
      explosion: config.explosion ?? 5,
      intensity: config.intensity ?? 30,
      flickering: config.flickering ?? 50,
      lineStyle: config.lineStyle ?? "round",
      hue: { min: config.hueMin ?? 0, max: config.hueMax ?? 360 },
      // Auto-fire off: push the inter-burst delay to infinity so rockets
      // ONLY spawn from clicks / cursor, never from the random loop.
      delay: noAutoFire
        ? { min: 999999, max: 999999 }
        : { min: config.delayMin ?? 30, max: config.delayMax ?? 60 },
      rocketsPoint: { min: config.rocketsPointMin ?? 30, max: config.rocketsPointMax ?? 70 },
      lineWidth: {
        explosion: { min: config.lineWidthExpMin ?? 1, max: config.lineWidthExpMax ?? 3 },
        trace: { min: config.lineWidthTraceMin ?? 1, max: config.lineWidthTraceMax ?? 2 },
      },
      brightness: { min: config.brightnessMin ?? 50, max: config.brightnessMax ?? 80 },
      decay: { min: config.decayMin ?? 0.015, max: config.decayMax ?? 0.03 },
      // The library's own click/move handlers are left OFF: they read raw
      // pageX/Y (wrong inside a transformed parent) and fire the public
      // launch(), which schedules the whole show to stop. The pointer
      // effect below drives clicks via createTrace instead.
      mouse: { click: false, move: false, max: interactive ? 20 : 1 },
      sound: { enabled: false },
      ...(config.boundaries ? { boundaries: config.boundaries } : {}),
    });
    fwRef.current = fw;
    // createCanvas inside the constructor resets boundaries to canvas
    // size — re-apply the area-derived boundaries.
    if (config.boundaries) fw.updateBoundaries(config.boundaries);
    if (autoStart) fw.start();
    return () => {
      fw.stop(false);
      fwRef.current = null;
    };
  }, []);

  // Click-to-launch / follow-cursor. The listeners live on a separate
  // hit element so clicks OUTSIDE the fireworks region pass straight
  // through to the page (buttons, links) instead of being swallowed.
  useEffect(() => {
    if (!config.followMouse && !config.followCursor) return;
    const hit = hitRef.current;
    const canvas = canvasRef.current;
    const fw = fwRef.current;
    if (!hit || !canvas || !fw) return;

    // Seed the rocket target so a cursor-driven spawn before the first
    // pointer event doesn't compute a NaN trajectory.
    fw.mouse.x = canvas.width / 2;
    fw.mouse.y = canvas.height / 2;
    if (config.followCursor) fw.mouse.active = true;

    const coords = (e) => {
      const r = canvas.getBoundingClientRect();
      const sx = r.width > 0 ? canvas.width / r.width : 1;
      const sy = r.height > 0 ? canvas.height / r.height : 1;
      return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
    };
    const onDown = (e) => {
      if (!config.followMouse) return;
      const { x, y } = coords(e);
      fw.mouse.x = x;
      fw.mouse.y = y;
      const wasActive = fw.mouse.active;
      fw.mouse.active = true;
      // createTrace fires one rocket NOW aimed at mouse.x/y — unlike
      // launch(), it has no deferred-stop side effect.
      try {
        fw.createTrace();
      } finally {
        fw.mouse.active = wasActive;
      }
    };
    const onMove = (e) => {
      if (!config.followCursor) return;
      const { x, y } = coords(e);
      fw.mouse.x = x;
      fw.mouse.y = y;
      fw.mouse.active = true;
    };
    hit.addEventListener("pointerdown", onDown);
    hit.addEventListener("pointermove", onMove);
    return () => {
      hit.removeEventListener("pointerdown", onDown);
      hit.removeEventListener("pointermove", onMove);
      fw.mouse.active = false;
    };
  }, []);

  const interactive = config.followMouse || config.followCursor;
  // "Only inside area" confines the interactive hit zone to the area
  // rectangle, so clicks elsewhere on the page aren't swallowed.
  // Otherwise the whole layer is interactive.
  const hitStyle =
    config.onlyInArea && config.area
      ? {
          position: "absolute",
          left: config.area.x,
          top: config.area.y,
          width: config.area.width,
          height: config.area.height,
          pointerEvents: "auto",
        }
      : { position: "absolute", inset: 0, pointerEvents: "auto" };

  return (
    <>
      {/* The canvas only renders — it never captures pointer events, so
          decorative fireworks can't block the page underneath. */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
      {interactive && <div ref={hitRef} style={hitStyle} />}
    </>
  );
}`;

  const layerJsx = fxs.map((e) => {
    const fw = e.fireworks!;
    const boundaries = fw.area ? areaToBoundaries(fw.area) : null;
    // Bake the config (minus area) + boundaries into the exported JSX.
    const cfg: Record<string, unknown> = {
      density: fw.density,
      explosion: fw.explosion,
      gravity: fw.gravity,
      opacity: fw.opacity,
      flickering: fw.flickering,
      acceleration: fw.acceleration,
      friction: fw.friction,
      traceLength: fw.traceLength,
      traceSpeed: fw.traceSpeed,
      intensity: fw.intensity,
      lineStyle: fw.lineStyle,
      followMouse: fw.followMouse,
      followCursor: fw.followCursor,
      autoFire: fw.autoFire,
      onlyInArea: fw.onlyInArea,
      delayMin: fw.delayMin,
      delayMax: fw.delayMax,
      brightnessMin: fw.brightnessMin,
      brightnessMax: fw.brightnessMax,
      decayMin: fw.decayMin,
      decayMax: fw.decayMax,
      hueMin: fw.hueMin,
      hueMax: fw.hueMax,
      rocketsPointMin: fw.rocketsPointMin,
      rocketsPointMax: fw.rocketsPointMax,
      lineWidthExpMin: fw.lineWidthExpMin,
      lineWidthExpMax: fw.lineWidthExpMax,
      lineWidthTraceMin: fw.lineWidthTraceMin,
      lineWidthTraceMax: fw.lineWidthTraceMax,
    };
    // Drop undefineds so the literal is compact.
    for (const k of Object.keys(cfg)) {
      if (cfg[k] === undefined) delete cfg[k];
    }
    // `area` positions the interactive hit zone; `boundaries` constrains
    // where rockets explode. Both are emitted in canvas-design px.
    if (fw.area) cfg.area = fw.area;
    if (boundaries) cfg.boundaries = boundaries;

    return `{/* fireworks-js effect ${e.id} */}
<FireworksLayer
  config={${JSON.stringify(cfg)}}
  width={${canvasWidth}}
  height={${canvasHeight}}
/>`;
  });

  return { extraImports, helperComponent, layerJsx };
}
