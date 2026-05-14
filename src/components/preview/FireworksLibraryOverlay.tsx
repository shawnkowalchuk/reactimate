import { useEffect, useRef, type RefObject } from "react";
import { Fireworks } from "fireworks-js";
import type { Effect } from "../../types/project";
import { usePlaybackStore } from "../../store/playbackStore";

interface Props {
  effects: Effect[];
  time: number;
  frameRef: RefObject<HTMLDivElement | null>;
}

export function FireworksLibraryOverlay({ effects, time, frameRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fwRef = useRef<Fireworks | null>(null);
  const runningRef = useRef(false);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

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

  // Initialize fireworks instance. Runs once on mount, cleans up on unmount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = frameRef.current;
    if (!frame) return;

    // Wait for parent dimensions.
    const parent = canvas.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    if (!r.width || !r.height || !f.width || !f.height) return;

    const designWidth = parseFloat(frame.style.width || "0") || f.width;
    const scale = designWidth > 0 ? f.width / designWidth : 1;
    const safeScale = Math.max(0.0001, scale);

    const active = effects.find((e) => e.type === "fireworks-js" && e.fireworks);
    const cfg = active?.fireworks;
    const isAround = cfg?.mode === "around";
    const radius = isAround ? (cfg?.spreadRadius ?? 100) * safeScale : 0;
    const groundBuffer = 150 * safeScale;
    const useW = Math.max(r.width, f.width * 0.15);
    const useH = Math.max(r.height, 40);

    canvas.width = (useW + radius * 2) / safeScale;
    canvas.height = (useH + groundBuffer) / safeScale;

    const fw = new Fireworks(canvas, {
      autoresize: false,
      opacity: cfg?.opacity ?? 0.5,
      acceleration: cfg?.acceleration ?? 1.05,
      friction: cfg?.friction ?? 0.97,
      gravity: cfg?.gravity ?? 1.5,
      particles: cfg?.density ?? 50,
      traceLength: cfg?.traceLength ?? 3,
      traceSpeed: cfg?.traceSpeed ?? 10,
      explosion: cfg?.explosion ?? 5,
      intensity: cfg?.intensity ?? 30,
      flickering: cfg?.flickering ?? 50,
      lineStyle: (cfg?.lineStyle as "round" | "square") ?? "round",
      hue: { min: cfg?.hueMin ?? 0, max: cfg?.hueMax ?? 360 },
      delay: { min: cfg?.delayMin ?? 10, max: cfg?.delayMax ?? 60 },
      rocketsPoint: { min: cfg?.rocketsPointMin ?? 30, max: cfg?.rocketsPointMax ?? 70 },
      lineWidth: {
        explosion: { min: cfg?.lineWidthExpMin ?? 1, max: cfg?.lineWidthExpMax ?? 3 },
        trace: { min: cfg?.lineWidthTraceMin ?? 1, max: cfg?.lineWidthTraceMax ?? 2 },
      },
      brightness: { min: cfg?.brightnessMin ?? 50, max: cfg?.brightnessMax ?? 80 },
      decay: { min: cfg?.decayMin ?? 0.015, max: cfg?.decayMax ?? 0.03 },
      mouse: { click: cfg?.followMouse ?? false, move: false, max: 1 },
      sound: { enabled: false },
    });

    fwRef.current = fw;
    console.log("[FWO] init — particles:", cfg?.density, "delay:", cfg?.delayMin, "size:", canvas.width, "x", canvas.height);

    // Start if should run.
    if (shouldRun) {
      fw.start();
      runningRef.current = true;
    }

    // ResizeObserver.
    const ro = new ResizeObserver(() => {
      const r2 = parent.getBoundingClientRect();
      const f2 = frame.getBoundingClientRect();
      if (!r2.width || !f2.width) return;
      const s2 = designWidth > 0 ? f2.width / designWidth : 1;
      const ss2 = Math.max(0.0001, s2);
      const rad2 = isAround ? (cfg?.spreadRadius ?? 100) * ss2 : 0;
      const gb = 150 * ss2;
      const w2 = Math.max(r2.width, f2.width * 0.15);
      const h2 = Math.max(r2.height, 40);
      canvas.width = (w2 + rad2 * 2) / ss2;
      canvas.height = (h2 + gb) / ss2;
      fw.updateSize({ width: canvas.width, height: canvas.height });
    });
    ro.observe(parent);
    ro.observe(frame);

    return () => {
      ro.disconnect();
      fw.stop(true);
      fwRef.current = null;
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
