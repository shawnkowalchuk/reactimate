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
 *   dx = random(boundaries.x, boundaries.width - boundaries.x * 2)
 *   dy = random(boundaries.y, boundaries.height / 2)
 *
 * Solving for dx in [area.x, area.x + area.width]:
 *   boundaries.x      = area.x
 *   boundaries.width  = 3 * area.x + area.width   (so width - 2*x = right)
 *
 * Solving for dy in [area.y, area.y + area.height]:
 *   boundaries.y      = area.y
 *   boundaries.height = 2 * (area.y + area.height)  (so height/2 = bottom)
 *
 * Rockets land within `area`; the explosion particles fly outward beyond it
 * (per design — the area indicates landing target, not a hard clip).
 */
function areaToBoundaries(area: EffectArea) {
  return {
    x: area.x,
    y: area.y,
    width: area.x * 3 + area.width,
    height: (area.y + area.height) * 2,
    debug: false,
  };
}

export function FireworksLibraryOverlay({ effects, time, frameRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fwRef = useRef<Fireworks | null>(null);
  const runningRef = useRef(false);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

  // Extract active fireworks-js config and build a stable key so the
  // update-options effect re-runs when settings change.
  const activeEffect = effects.find((e) => e.type === "fireworks-js" && e.fireworks);
  const cfg = activeEffect?.fireworks;
  const cfgKey = cfg ? JSON.stringify(cfg) : "";
  // Mirror the latest cfg so the (empty-dep) init effect's ResizeObserver
  // can read the current area when the canvas resizes — without this it'd
  // re-apply the stale initial cfg.area after every updateSize call.
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

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
      // fireworks-js's built-in mouse handlers compute click coords via
      // `pageX - canvas.offsetLeft`, which gives wrong values inside any
      // CSS-transformed parent (our preview always scales). We disable
      // the library's mouse handling entirely and run our own listeners
      // below — they compute correct coords via getBoundingClientRect
      // and call fw.launch() / poke fw.mouse.x|y directly.
      mouse: { click: false, move: false, max: 1 },
      sound: { enabled: false },
      ...(boundaries ? { boundaries } : {}),
    });

    fwRef.current = fw;

    // updateSize INSIDE the constructor (via createCanvas) clobbers our
    // boundaries width/height back to canvas size. Re-apply now.
    if (cfg.area) fw.updateBoundaries(areaToBoundaries(cfg.area));

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
      // updateSize internally calls updateBoundaries with canvas width/height
      // — restore our area-derived boundaries afterwards (latest cfg, not the
      // stale closure value).
      const latest = cfgRef.current;
      if (latest?.area) fw.updateBoundaries(areaToBoundaries(latest.area));
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
    // Init effect runs once. Subsequent cfg / shouldRun / frameRef changes
    // are handled by the [cfgKey] update-options effect below and the
    // [shouldRun] start/stop effect — including them here would needlessly
    // tear down and re-create the fireworks-js instance on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // See init effect — we keep library mouse handling off and run our
      // own pointer listeners (in the separate effect below).
      mouse: { click: false, move: false, max: 1 },
    });
    if (cfg.area) {
      fw.updateBoundaries(areaToBoundaries(cfg.area));
    }
    // cfgKey is the JSON-stringified cfg — re-running on cfgKey covers
    // every cfg field change. Listing `cfg` directly would re-run on
    // every parent render (new object identity) even with no value change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Custom pointer handlers for Click to launch + Follow cursor. We
  // replace the library's built-in mouse handling (which computes click
  // coords via `pageX - canvas.offsetLeft` — broken inside any CSS-
  // transformed parent, which our preview always is) with our own
  // listeners. Coords are computed via getBoundingClientRect so the
  // canvas-to-viewport scale is correctly inverted.
  //
  // Internals we poke:
  // - fw.mouse.x|y: the rocket target (canvas-buffer pixels)
  // - fw.mouse.active: when true, createTrace uses mouse.x|y as the
  //   target (bypasses random boundary-based targeting)
  // - fw.createTrace(): spawn one rocket NOW
  //
  // Why not fw.launch(): launch() has a side effect — it calls
  // waitStop() the first time it's invoked, which schedules the whole
  // fireworks instance to halt after the launched rocket finishes.
  // Fine for one-shot celebration use cases ("fire 50 rockets and
  // stop"), wrong for our continuous per-click spawning.
  //
  // Why mouse.active (not opts.mouse.move): the move flag in opts gets
  // wiped on every updateOptions() call (we issue one on every cfgKey
  // change). mouse.active is internal state — nothing else touches it.
  const followMouse = Boolean(cfg?.followMouse);
  const followCursor = Boolean(cfg?.followCursor);
  useEffect(() => {
    const canvas = canvasRef.current;
    const fw = fwRef.current;
    if (!canvas || !fw) return;
    if (!followMouse && !followCursor) return;

    const fwInternal = fw as unknown as {
      mouse: { x: number; y: number; active: boolean };
      createTrace: () => void;
      opts: { rocketsPoint: { min: number; max: number } };
    };

    // Seed mouse.x|y to canvas center BEFORE doing anything else.
    // mouse.x / mouse.y are undefined out of the box. If active gets
    // turned on for Follow cursor and the delay-based spawn fires
    // before the user has moved the cursor over the canvas, the
    // library reads `this.mouse.x` (undefined) and builds the trace
    // with `dx: undefined`. atan2 then returns NaN, the trace's
    // angle is NaN, position never advances correctly, and the
    // rocket either glitches or explodes at a bogus location.
    fwInternal.mouse.x = canvas.width / 2;
    fwInternal.mouse.y = canvas.height / 2;

    // While Follow cursor is on, keep mouse.active true so the delay-
    // based spawn loop in createTrace honors mouse.x|y as the target.
    // (Click to launch alone doesn't need it — we set + reset around
    // the createTrace() call inside onPointerDown.)
    if (followCursor) fwInternal.mouse.active = true;

    const localCoords = (e: PointerEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      const sx = rect.width > 0 ? canvas.width / rect.width : 1;
      const sy = rect.height > 0 ? canvas.height / rect.height : 1;
      return {
        x: (e.clientX - rect.left) * sx,
        y: (e.clientY - rect.top) * sy,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!followMouse) return;
      const { x, y } = localCoords(e);
      fwInternal.mouse.x = x;
      fwInternal.mouse.y = y;
      // Spawn the rocket from canvas-bottom directly BELOW the click X
      // so the arc goes straight up to where the user clicked — makes
      // the cause/effect obvious. createTrace reads rocketsPoint to
      // pick the spawn X as `width * rocketsPoint% / 100`; pinning
      // both min and max to the click X percentage gives a vertical
      // arc. Snapshot & restore the user's setting so this doesn't
      // affect their normal delay-based spawn pattern.
      const pct = canvas.width > 0
        ? Math.max(0, Math.min(100, (x / canvas.width) * 100))
        : 50;
      const prevMin = fwInternal.opts.rocketsPoint.min;
      const prevMax = fwInternal.opts.rocketsPoint.max;
      fwInternal.opts.rocketsPoint.min = pct;
      fwInternal.opts.rocketsPoint.max = pct;
      const wasActive = fwInternal.mouse.active;
      fwInternal.mouse.active = true;
      try {
        // Direct createTrace bypasses launch()'s deferred-stop side
        // effect AND the library's mouse.max gate on click-triggered
        // spawns. Every click reliably spawns one rocket aimed at the
        // click point regardless of how many rockets are in flight.
        fwInternal.createTrace();
      } finally {
        fwInternal.mouse.active = wasActive;
        fwInternal.opts.rocketsPoint.min = prevMin;
        fwInternal.opts.rocketsPoint.max = prevMax;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!followCursor) return;
      const { x, y } = localCoords(e);
      fwInternal.mouse.x = x;
      fwInternal.mouse.y = y;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      fwInternal.mouse.active = false;
    };
  }, [followMouse, followCursor]);

  // Canvas catches pointer events only when click-to-launch or follow-cursor
  // is on — otherwise the EffectAreaOverlay bbox handles need pointer access
  // to be draggable, and the canvas would otherwise eat their events.
  // fireworks-js attaches its own pointer listeners to the canvas; enabling
  // pointer-events here is what makes click-to-launch actually work.
  const canvasPointer = cfg?.followMouse || cfg?.followCursor ? "auto" : "none";
  return (
    <span style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: canvasPointer,
        }}
      />
    </span>
  );
}
