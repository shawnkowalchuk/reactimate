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
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
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
      delay: { min: config.delayMin ?? 30, max: config.delayMax ?? 60 },
      rocketsPoint: { min: config.rocketsPointMin ?? 30, max: config.rocketsPointMax ?? 70 },
      lineWidth: {
        explosion: { min: config.lineWidthExpMin ?? 1, max: config.lineWidthExpMax ?? 3 },
        trace: { min: config.lineWidthTraceMin ?? 1, max: config.lineWidthTraceMax ?? 2 },
      },
      brightness: { min: config.brightnessMin ?? 50, max: config.brightnessMax ?? 80 },
      decay: { min: config.decayMin ?? 0.015, max: config.decayMax ?? 0.03 },
      mouse: { click: config.followMouse ?? false, move: config.followCursor ?? false, max: 1 },
      sound: { enabled: false },
      ...(config.boundaries ? { boundaries: config.boundaries } : {}),
    });
    if (config.boundaries) fw.updateBoundaries(config.boundaries);
    if (autoStart) fw.start();
    return () => fw.stop(false);
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: config.followMouse || config.followCursor ? "auto" : "none",
      }}
    />
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
