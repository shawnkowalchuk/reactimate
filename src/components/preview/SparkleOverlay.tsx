import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Effect } from "../../types/project";
import { useSpotlightStore } from "../../store/spotlightStore";

interface SparkleOverlayProps {
  effects: Effect[];
  /** Current playback time in seconds. */
  time: number;
  /** Canvas frame ref (used to recover the design-space scale). */
  frameRef: RefObject<HTMLDivElement | null>;
}

const PRESET_COLOR_FNS: Record<
  NonNullable<Effect["sparkle"]>["preset"],
  (i: number, custom: string) => string
> = {
  gold: () => "#fbbf24",
  silver: () => "#e5e7eb",
  rainbow: (i) => `hsl(${(i * 47) % 360}, 90%, 60%)`,
  fire: (i) => {
    const palette = ["#fde047", "#fb923c", "#ef4444", "#f97316"];
    return palette[i % palette.length];
  },
  custom: (_i, custom) => custom,
};

interface LiveSparkle {
  id: number;
  /** Current position in the wrapper's local coordinate space (design px). */
  x: number;
  y: number;
  /** Per-sparkle offset from the cursor (design px). Persistent so each
   *  sparkle keeps its relative position while chasing the cursor. */
  offsetX: number;
  offsetY: number;
  baseRotation: number;
  bornAtMs: number;
  color: string;
  size: number;
  lifespanMs: number;
  rotationSpeed: number;
}

/**
 * Per-component sparkle particle renderer. Mounted as an absolute child
 * of the component's wrapper. Four modes:
 *  - "component": deterministic random points within the wrapper's bbox
 *  - "around":    same bbox extended outward by `rangePx`
 *  - "follow":    sparkles spawn at the cursor anywhere over the canvas
 *  - "hover":     sparkles spawn at the cursor ONLY while it's over the
 *                 owning component's text bbox (text-gated trail)
 *
 * Knobs honored: lifespanSec, sizeJitter, rotationSpeed, spawnRadiusPx.
 */
export function SparkleOverlay({ effects, time, frameRef }: SparkleOverlayProps) {
  const selfRef = useRef<HTMLSpanElement>(null);
  const [, setLayoutTick] = useState(0);
  const sizeRef = useRef<{ w: number; h: number; ox: number; oy: number }>({
    w: 0,
    h: 0,
    ox: 0,
    oy: 0,
  });

  const mouse = useSpotlightStore((s) => s.mouse);
  // Mirror the latest mouse into a ref so the rAF tick always sees the
  // current value WITHOUT being torn down on every cursor move.
  const mouseRef = useRef(mouse);
  mouseRef.current = mouse;

  const [liveSparkles, setLiveSparkles] = useState<LiveSparkle[]>([]);
  const nextIdRef = useRef(1);
  // Used to force a re-render every animation frame while live sparkles
  // exist, so their rotation / opacity update smoothly.
  const [renderTick, setRenderTick] = useState(0);

  useLayoutEffect(() => {
    const self = selfRef.current;
    const frame = frameRef.current;
    if (!self || !frame) return;
    const wrap = self.parentElement;
    if (!wrap) return;
    const compute = () => {
      const w = wrap.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      const designWidth = parseFloat(frame.style.width || "0") || f.width;
      const scale = designWidth > 0 ? f.width / designWidth : 1;
      const safeScale = Math.max(0.0001, scale);
      sizeRef.current = {
        w: w.width / safeScale,
        h: w.height / safeScale,
        ox: (w.left - f.left) / safeScale,
        oy: (w.top - f.top) / safeScale,
      };
      setLayoutTick((t) => t + 1);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [frameRef]);

  // Find any sparkle effect on this component (or overlapping it) that is
  // CURRENTLY in its time window AND uses an interactive (live) mode.
  // We only check time + mode here; per-frame we re-check cursor position
  // inside the rAF tick so the spawner doesn't tear down on each move.
  const { w, h } = sizeRef.current;
  const liveCandidates = effects.filter((e) => {
    if (e.type !== "sparkle" || !e.sparkle) return false;
    if (time < e.startTime || time > e.startTime + e.duration) return false;
    return e.sparkle.mode === "follow" || e.sparkle.mode === "hover";
  });
  const hasCandidates = liveCandidates.length > 0;

  // Stash the current bbox + candidates in refs so the rAF tick always
  // sees the latest values without being re-scheduled on each mouse move
  // or re-render.
  const bboxRef = useRef(sizeRef.current);
  bboxRef.current = sizeRef.current;
  const candidatesRef = useRef(liveCandidates);
  candidatesRef.current = liveCandidates;

  // Spawner + culler for live sparkles. The rAF runs continuously while
  // there's a candidate effect (in its time window). Each frame the tick
  // checks the live mouse position + bbox to decide whether to spawn.
  useEffect(() => {
    if (!hasCandidates) {
      if (liveSparkles.length > 0) setLiveSparkles([]);
      return;
    }
    const lastSpawn: Record<string, number> = {};
    const tick = () => {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const m = mouseRef.current;
      const bbox = bboxRef.current;
      // CHASE: each frame, lerp every alive sparkle's position toward
      // (cursor + its persistent offset). With factor 0.18 sparkles
      // visibly trail the cursor and converge on it when stationary.
      const chase = 0.18;
      setLiveSparkles((prev) =>
        prev
          .filter((s) => now - s.bornAtMs < s.lifespanMs)
          .map((s) => {
            if (!m) return s;
            const targetX = m.x - bbox.ox + s.offsetX;
            const targetY = m.y - bbox.oy + s.offsetY;
            return {
              ...s,
              x: s.x + (targetX - s.x) * chase,
              y: s.y + (targetY - s.y) * chase,
            };
          }),
      );
      const overBbox =
        m != null &&
        m.x >= bbox.ox &&
        m.x <= bbox.ox + bbox.w &&
        m.y >= bbox.oy &&
        m.y <= bbox.oy + bbox.h;
      for (const e of candidatesRef.current) {
        const cfg = e.sparkle!;
        const allowed = cfg.mode === "follow" ? m != null : overBbox;
        if (!allowed) continue;
        const intervalMs = 1000 / Math.max(0.1, cfg.density);
        const last = lastSpawn[e.id] ?? 0;
        if (now - last >= intervalMs && m) {
          const jitter = cfg.spawnRadiusPx ?? 30;
          const sizeJitter = cfg.sizeJitter ?? 0.4;
          const colorFn = PRESET_COLOR_FNS[cfg.preset];
          const color = colorFn(nextIdRef.current, cfg.color);
          const sizeMul = 1 + (Math.random() - 0.5) * 2 * sizeJitter;
          const size = Math.max(2, cfg.size * sizeMul);
          const offsetX = (Math.random() - 0.5) * jitter * 2;
          const offsetY = (Math.random() - 0.5) * jitter * 2;
          setLiveSparkles((prev) => [
            ...prev,
            {
              id: nextIdRef.current++,
              x: m.x - bbox.ox + offsetX,
              y: m.y - bbox.oy + offsetY,
              offsetX,
              offsetY,
              baseRotation: Math.random() * 360,
              bornAtMs: now,
              color,
              size,
              lifespanMs: (cfg.lifespanSec ?? 0.6) * 1000,
              rotationSpeed: cfg.rotationSpeed ?? 0,
            },
          ]);
          lastSpawn[e.id] = now;
        }
      }
      setRenderTick((t) => t + 1);
    };
    const intervalId = window.setInterval(tick, 33); // ~30 fps
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCandidates, liveCandidates.map((e) => e.id).join(",")]);

  // Build deterministic sparkles for "component" + "around" modes.
  const detSparkles: Array<{
    key: string;
    x: number;
    y: number;
    size: number;
    color: string;
    opacity: number;
    rotation: number;
  }> = [];
  for (const e of effects) {
    if (e.type !== "sparkle" || !e.sparkle) continue;
    const cfg = e.sparkle;
    if (cfg.mode === "follow" || cfg.mode === "hover") continue;
    const end = e.startTime + e.duration;
    if (time < e.startTime) continue;
    if (!cfg.continueAfter && time > end) continue;
    // For looping mode (continueAfter), keep producing sparkles at the
    // same density indefinitely. We extend the "total" count linearly
    // with elapsed time, so the spawn-time spread continues past `end`.
    const elapsed = Math.max(0, time - e.startTime);
    const totalSpan =
      cfg.continueAfter && time > end ? elapsed + 0.5 : e.duration;
    const total = Math.max(1, Math.round(cfg.density * totalSpan));
    const lifespan = cfg.lifespanSec ?? 0.6;
    const padding = cfg.mode === "around" ? cfg.rangePx ?? 20 : 0;
    const sparkleType: NonNullable<NonNullable<Effect["sparkle"]>["type"]> =
      cfg.type ?? "standard";
    const sizeJitter = cfg.sizeJitter ?? 0.4;
    const rotSpeed = cfg.rotationSpeed ?? 0;
    for (let i = 0; i < total; i++) {
      const seed = hash(`${e.id}_${i}`);
      const spawnT = e.startTime + (i / total) * totalSpan;
      const age = time - spawnT;
      if (age < 0 || age > lifespan) continue;
      const path = particlePath(sparkleType, seed, w, h, padding, age, lifespan);
      if (!path) continue;
      const baseRot = pseudo(seed, 3) * 360;
      const rotation = baseRot + rotSpeed * age;
      const sizeMul = 1 + (pseudo(seed, 4) - 0.5) * 2 * sizeJitter;
      const size = Math.max(2, cfg.size * sizeMul);
      const color = PRESET_COLOR_FNS[cfg.preset]?.(i, cfg.color) ?? cfg.color;
      detSparkles.push({
        key: `${e.id}_${i}`,
        x: path.x,
        y: path.y,
        size,
        color,
        opacity: path.opacity,
        rotation,
      });
    }
  }

  // Each render, recompute live sparkle visuals from their birth time.
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  void renderTick; // ensure dep is "read" so the linter is happy

  return (
    <span
      ref={selfRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {detSparkles.map(({ key, ...s }) => (
        <Sparkle key={key} {...s} />
      ))}
      {liveSparkles.map((s) => {
        const age = nowMs - s.bornAtMs;
        const t01 = Math.min(1, Math.max(0, age / s.lifespanMs));
        const opacity = t01 < 0.5 ? t01 * 2 : 2 - t01 * 2;
        const rotation = s.baseRotation + s.rotationSpeed * (age / 1000);
        return (
          <Sparkle
            key={`live_${s.id}`}
            x={s.x}
            y={s.y}
            size={s.size}
            color={s.color}
            opacity={opacity}
            rotation={rotation}
          />
        );
      })}
    </span>
  );
}

function Sparkle({
  x,
  y,
  size,
  color,
  opacity,
  rotation,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  rotation: number;
}) {
  const path =
    "M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        opacity,
        transform: `rotate(${rotation}deg)`,
        pointerEvents: "none",
      }}
    >
      <path d={path} fill={color} />
    </svg>
  );
}

/**
 * Per-type particle physics. Returns the particle's position + opacity
 * at a given age, or null if the particle isn't visible. Spawn origins
 * and motion are derived deterministically from `seed` so playback is
 * reproducible.
 */
function particlePath(
  type: NonNullable<NonNullable<Effect["sparkle"]>["type"]>,
  seed: number,
  w: number,
  h: number,
  padding: number,
  age: number,
  lifespan: number,
): { x: number; y: number; opacity: number } | null {
  const t01 = lifespan > 0 ? age / lifespan : 1;

  if (type === "standard") {
    // Random fixed position in the (optionally padded) bbox.
    const minX = -padding;
    const minY = -padding;
    const rangeX = w + padding * 2;
    const rangeY = h + padding * 2;
    const x = minX + pseudo(seed, 1) * rangeX;
    const y = minY + pseudo(seed, 2) * rangeY;
    const opacity = t01 < 0.5 ? t01 * 2 : 2 - t01 * 2;
    return { x, y, opacity };
  }

  if (type === "fireworks") {
    // Radiate out from bbox center with deceleration. Speed is moderate
    // so the burst stays around the text.
    const cx = w / 2;
    const cy = h / 2;
    const angle = pseudo(seed, 1) * Math.PI * 2;
    const speed = 80 + pseudo(seed, 2) * 80; // px/sec
    // Slow down over lifespan via 1 - t^2 (cubic-ish ease-out distance).
    const dist = speed * age * (1 - t01 * 0.5);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    // Fade out linearly across lifespan.
    const opacity = Math.max(0, 1 - t01);
    return { x, y, opacity };
  }

  if (type === "volcano") {
    // Spawn near bottom-center; shoot up with random initial velocity,
    // then fall under gravity. Visible the whole lifespan.
    const cx = w / 2;
    const spawnSpread = w * 0.18;
    const spawnX = cx + (pseudo(seed, 1) - 0.5) * 2 * spawnSpread;
    const spawnY = h - 4; // just above the bottom
    const upVel = 220 + pseudo(seed, 2) * 80; // px/sec upward
    const horizDrift = (pseudo(seed, 5) - 0.5) * 60; // small sideways drift
    const gravity = 600; // px/sec^2 downward
    const x = spawnX + horizDrift * age;
    const y = spawnY - upVel * age + 0.5 * gravity * age * age;
    // Fade in over first 10%, hold, fade out over last 30%.
    let opacity = 1;
    if (t01 < 0.1) opacity = t01 / 0.1;
    else if (t01 > 0.7) opacity = Math.max(0, (1 - t01) / 0.3);
    return { x, y, opacity };
  }

  if (type === "dropping") {
    // Spawn ABOVE the bbox across the width; fall straight down with
    // a small horizontal drift. Fade in / steady / fade out envelope.
    const spawnX = pseudo(seed, 1) * w;
    const spawnY = -padding - 20 - pseudo(seed, 2) * 40;
    const fallVel = 140 + pseudo(seed, 5) * 100; // px/sec
    const drift = (pseudo(seed, 6) - 0.5) * 30;
    const x = spawnX + drift * age;
    const y = spawnY + fallVel * age + 0.5 * 200 * age * age;
    let opacity = 1;
    if (t01 < 0.2) opacity = t01 / 0.2;
    else if (t01 > 0.75) opacity = Math.max(0, (1 - t01) / 0.25);
    return { x, y, opacity };
  }

  return null;
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function pseudo(seed: number, k: number): number {
  let t = (seed + k * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
