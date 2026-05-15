import { useEffect, useRef, type RefObject } from "react";
import { Fireworks } from "fireworks-js";
import type { Effect, EffectArea } from "../../types/project";
import { usePlaybackStore } from "../../store/playbackStore";

interface Props {
  effects: Effect[];
  time: number;
  frameRef: RefObject<HTMLDivElement | null>;
}

/**
 * Translate an `EffectArea` (canvas-design coords) into the `boundaries`
 * shape fireworks-js expects. The library's rocket-target math is:
 *   dx = random(boundaries.x, boundaries.width - boundaries.x*2)
 *   dy = random(boundaries.y, boundaries.height/2)
 * So to get dx in [area.x, area.right] and dy in [area.y, area.bottom]:
 *   boundaries.x      = area.x
 *   boundaries.width  = area.right + area.x
 *   boundaries.y      = area.y
 *   boundaries.height = 2 * area.bottom
 * Rockets land within `area`; the explosion particles fly outward beyond it
 * (per design — the area indicates landing target, not a hard clip).
 */
function areaToBoundaries(area: EffectArea) {
  const right = area.x + area.width;
  const bottom = area.y + area.height;
  return {
    x: area.x,
    y: area.y,
    width: right + area.x,
    height: bottom * 2,
    debug: false,
  };
}

export function FireworksLibraryOverlay({ effects, time, frameRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fwRef = useRef<Fireworks | null>(null);
  const runningRef = useRef(false);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

  // Extract active fireworks-js config and build a stable key so the
  // init effect re-runs (destroying + recreating) when settings change.
  const activeEffect = effects.find((e) => e.type === "fireworks-js" && e.fireworks);
  const cfg = activeEffect?.fireworks;
  const cfgKey = cfg ? JSON.stringify(cfg) : "";

  // When should the fireworks run?
  let shouldRun = false;
  for (const e of effects) {
    if (e.type !== "fireworks-js" || !e.fireworks) continue;
    const end = e.startTime + e.duration;
    if (time < e.startTime) continue;
    const isInWindow = time <= end;
    if (isPlaying && isInWindow) { shouldRun = true; break; }
    if (e.fireworks.continueAfter && time > e.startTime) { shouldRun = true; break; }
  }

  // Initialize fireworks instance once on mount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cfg) return;
    const frame = frameRef.current;
    if (!frame) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const r = parent.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    if (!r.width || !r.height || !f.width || !f.height) return;

    // The canvas covers the entire preview frame in DESIGN coordinates;
    // boundaries (set per-effect from cfg.area) constrain where rockets
    // explode within that canvas. CSS scales it via the parent transform.
    const designWidth = parseFloat(frame.style.width || "0") || f.width;
    const designHeight = parseFloat(frame.style.height || "0") || f.height;
    canvas.width = designWidth;
    canvas.height = designHeight;

    const boundaries = cfg.area ? areaToBoundaries(cfg.area) : undefined;

    const fw = new Fireworks(canvas, {
      autoresize: false,
      opacity: cfg.opacity ?? 0.5,
      acceleration: cfg.acceleration ?? 1.05,
      friction: cfg.friction ?? 0.97,
      gravity: cfg.gravity ?? 1.5,
      particles: cfg.density ?? 50,
      traceLength: cfg.traceLength ?? 3,
      traceSpeed: cfg.traceSpeed ?? 10,
      explosion: cfg.explosion ?? 5,
      intensity: cfg.intensity ?? 30,
      flickering: cfg.flickering ?? 50,
      lineStyle: (cfg.lineStyle as "round" | "square") ?? "round",
      hue: { min: cfg.hueMin ?? 0, max: cfg.hueMax ?? 360 },
      delay: { min: cfg.delayMin ?? 10, max: cfg.delayMax ?? 60 },
      rocketsPoint: { min: cfg.rocketsPointMin ?? 30, max: cfg.rocketsPointMax ?? 70 },
      lineWidth: {
        explosion: { min: cfg.lineWidthExpMin ?? 1, max: cfg.lineWidthExpMax ?? 3 },
        trace: { min: cfg.lineWidthTraceMin ?? 1, max: cfg.lineWidthTraceMax ?? 2 },
      },
      brightness: { min: cfg.brightnessMin ?? 50, max: cfg.brightnessMax ?? 80 },
      decay: { min: cfg.decayMin ?? 0.015, max: cfg.decayMax ?? 0.03 },
      mouse: { click: cfg.followMouse ?? false, move: false, max: 1 },
      sound: { enabled: false },
      ...(boundaries ? { boundaries } : {}),
    });

    fwRef.current = fw;

    if (shouldRun) {
      fw.start();
      runningRef.current = true;
    }

    const ro = new ResizeObserver(() => {
      const f2 = frame.getBoundingClientRect();
      if (!f2.width) return;
      const dw = parseFloat(frame.style.width || "0") || f2.width;
      const dh = parseFloat(frame.style.height || "0") || f2.height;
      canvas.width = dw;
      canvas.height = dh;
      fw.updateSize({ width: canvas.width, height: canvas.height });
    });
    ro.observe(parent);
    ro.observe(frame);

    return () => {
      ro.disconnect();
      // Use stop(false) — passing true calls canvas.remove() from the DOM,
      // and on a strict-mode re-mount the next createCanvas call sees
      // canvas.isConnected === false and re-attaches it to document.body.
      fw.stop(false);
      fwRef.current = null;
      runningRef.current = false;
    };
  }, []);

  // Update live options when config changes without destroying the instance.
  useEffect(() => {
    const fw = fwRef.current;
    if (!fw || !cfg) return;
    fw.updateOptions({
      opacity: cfg.opacity ?? 0.5,
      acceleration: cfg.acceleration ?? 1.05,
      friction: cfg.friction ?? 0.97,
      gravity: cfg.gravity ?? 1.5,
      particles: cfg.density ?? 50,
      traceLength: cfg.traceLength ?? 3,
      traceSpeed: cfg.traceSpeed ?? 10,
      explosion: cfg.explosion ?? 5,
      intensity: cfg.intensity ?? 30,
      flickering: cfg.flickering ?? 50,
      lineStyle: (cfg.lineStyle as "round" | "square") ?? "round",
      hue: { min: cfg.hueMin ?? 0, max: cfg.hueMax ?? 360 },
      delay: { min: cfg.delayMin ?? 10, max: cfg.delayMax ?? 60 },
      rocketsPoint: { min: cfg.rocketsPointMin ?? 30, max: cfg.rocketsPointMax ?? 70 },
      lineWidth: {
        explosion: { min: cfg.lineWidthExpMin ?? 1, max: cfg.lineWidthExpMax ?? 3 },
        trace: { min: cfg.lineWidthTraceMin ?? 1, max: cfg.lineWidthTraceMax ?? 2 },
      },
      brightness: { min: cfg.brightnessMin ?? 50, max: cfg.brightnessMax ?? 80 },
      decay: { min: cfg.decayMin ?? 0.015, max: cfg.decayMax ?? 0.03 },
      mouse: { click: cfg.followMouse ?? false, move: false, max: 1 },
    });
    if (cfg.area) {
      fw.updateBoundaries(areaToBoundaries(cfg.area));
    }
  }, [cfgKey]);

  // Start / stop based on shouldRun.
  useEffect(() => {
    const fw = fwRef.current;
    if (!fw) return;
    if (shouldRun && !runningRef.current) {
      fw.start();
      runningRef.current = true;
    } else if (!shouldRun && runningRef.current) {
      fw.waitStop(false);
      runningRef.current = false;
    }
  }, [shouldRun]);

  return (
    <span style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      />
    </span>
  );
}
