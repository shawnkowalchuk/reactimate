import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Effect } from "../../types/project";
import { useSpotlightStore } from "../../store/spotlightStore";
import { PRESET_COLOR_FNS, PARTICLE_SHAPES, particlePath, hash, pseudo, type ParticleShape } from "./particleUtils";

interface ParticleOverlayProps {
  effects: Effect[];
  /** Current playback time in seconds. */
  time: number;
  /** Canvas frame ref (used to recover the design-space scale). */
  frameRef: RefObject<HTMLDivElement | null>;
}

interface LiveParticle {
  id: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  baseRotation: number;
  bornAtMs: number;
  color: string;
  size: number;
  lifespanMs: number;
  rotationSpeed: number;
  shape: ParticleShape;
}

/**
 * Per-component particle renderer. Mounted as an absolute child
 * of the component's wrapper. Four modes:
 *  - "component": deterministic random points within the wrapper's bbox
 *  - "around":    same bbox extended outward by `rangePx`
 *  - "follow":    particles spawn at the cursor anywhere over the canvas
 *  - "hover":     particles spawn at the cursor ONLY while it's over the
 *                 owning component's text bbox (text-gated trail)
 *
 * Knobs honored: lifespanSec, sizeJitter, rotationSpeed, spawnRadiusPx.
 */
export function ParticleOverlay({ effects, time, frameRef }: ParticleOverlayProps) {
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

  const [liveParticles, setLiveParticles] = useState<LiveParticle[]>([]);
  const nextIdRef = useRef(1);
  // Used to force a re-render every animation frame while live particles
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

  // Find any particle effect on this component (or overlapping it) that is
  // CURRENTLY in its time window AND uses an interactive (live) mode.
  // We only check time + mode here; per-frame we re-check cursor position
  // inside the rAF tick so the spawner doesn't tear down on each move.
  const { w, h } = sizeRef.current;
  const liveCandidates = effects.filter((e) => {
    if (e.type !== "particle" || !e.particle) return false;
    if (time < e.startTime || time > e.startTime + e.duration) return false;
    return e.particle.mode === "follow" || e.particle.mode === "hover";
  });
  const hasCandidates = liveCandidates.length > 0;

  // Stash the current bbox + candidates in refs so the rAF tick always
  // sees the latest values without being re-scheduled on each mouse move
  // or re-render.
  const bboxRef = useRef(sizeRef.current);
  bboxRef.current = sizeRef.current;
  const candidatesRef = useRef(liveCandidates);
  candidatesRef.current = liveCandidates;

  // Spawner + culler for live particles. The rAF runs continuously while
  // there's a candidate effect (in its time window). Each frame the tick
  // checks the live mouse position + bbox to decide whether to spawn.
  useEffect(() => {
    if (!hasCandidates) {
      if (liveParticles.length > 0) setLiveParticles([]);
      return;
    }
    const lastSpawn: Record<string, number> = {};
    const tick = () => {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const m = mouseRef.current;
      const bbox = bboxRef.current;
      // CHASE: each frame, lerp every alive particle's position toward
      // (cursor + its persistent offset). With factor 0.18 particles
      // visibly trail the cursor and converge on it when stationary.
      const chase = 0.18;
      setLiveParticles((prev) =>
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
        const cfg = e.particle!;
        const allowed = cfg.mode === "follow" ? m != null : overBbox;
        if (!allowed) continue;
        const intervalMs = 1000 / Math.max(0.1, cfg.density);
        const last = lastSpawn[e.id] ?? 0;
        if (now - last >= intervalMs && m) {
          const jitter = cfg.spawnRadiusPx ?? 30;
          const sizeJitter = cfg.sizeJitter ?? 0.4;
          const shape = cfg.shape ?? "star";
          const colorFn = PRESET_COLOR_FNS[cfg.preset];
          const color = colorFn(nextIdRef.current, cfg.color);
          const sizeMul = 1 + (Math.random() - 0.5) * 2 * sizeJitter;
          const size = Math.max(2, cfg.size * sizeMul);
          const offsetX = (Math.random() - 0.5) * jitter * 2;
          const offsetY = (Math.random() - 0.5) * jitter * 2;
          setLiveParticles((prev) => [
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
              shape,
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

  // Build deterministic particles for "component" + "around" modes.
  const detParticles: Array<{
    key: string;
    x: number;
    y: number;
    size: number;
    color: string;
    opacity: number;
    rotation: number;
    shape: ParticleShape;
    scale: number;
  }> = [];
  // Guard: don't compute until wrapper dimensions are measured.
  if (w <= 0 || h <= 0) {
    // skip — particles would collapse to (0,0)
  } else {
  for (const e of effects) {
    if (e.type !== "particle" || !e.particle) continue;
    const cfg = e.particle;
    if (cfg.mode === "follow" || cfg.mode === "hover") continue;
    const end = e.startTime + e.duration;
    if (time < e.startTime) continue;
    if (!cfg.continueAfter && time > end) continue;
    const lifespan = cfg.lifespanSec ?? 0.6;
    const padding = cfg.mode === "around" ? cfg.rangePx ?? 20 : 0;
    const particleType: NonNullable<NonNullable<Effect["particle"]>["type"]> =
      cfg.type ?? "standard";
    const shape = cfg.shape ?? "star";
    const sizeJitter = cfg.sizeJitter ?? 0.4;
    const rotSpeed = cfg.rotationSpeed ?? 0;
    // When continueAfter is active and time is past the effect's end,
    // distribute spawn times only across the current visibility window
    // [time - lifespan, time] so particles are actually visible.
    if (cfg.continueAfter && time > end) {
      const multiplier = particleType === "fireworks" ? 8 : 1;
      const total = Math.max(1, Math.round(cfg.density * lifespan * multiplier));
      const baseTime = time - lifespan;
      for (let i = 0; i < total; i++) {
        const seed = hash(`${e.id}_cont_${i}${particleType === "standard" ? "_" + Math.floor(time * 20) : ""}`);
        const spawnT = baseTime + (i / total) * lifespan;
        const age = time - spawnT;
        if (age < 0 || age > lifespan) continue;
        const path = particlePath(particleType, seed, w, h, padding, age, lifespan);
        if (!path) continue;
        const baseRot = pseudo(seed, 3) * 360;
        const rotation = baseRot + rotSpeed * age;
        const sizeMul = 1 + (pseudo(seed, 4) - 0.5) * 2 * sizeJitter;
        const size = Math.max(2, cfg.size * sizeMul);
        const color = PRESET_COLOR_FNS[cfg.preset]?.(i, cfg.color) ?? cfg.color;
        detParticles.push({
          key: `${e.id}_cont_${i}`,
          x: path.x,
          y: path.y,
          size,
          color,
          opacity: path.opacity,
          rotation,
          shape,
          scale: path.scale ?? 1,
        });
      }
    } else {
      const multiplier = particleType === "fireworks" ? 8 : 1;
      const total = Math.max(1, Math.round(cfg.density * e.duration * multiplier));
      for (let i = 0; i < total; i++) {
        // For standard particles, mix time into seed for gentle drift.
        // For fireworks/volcano/dropping, keep seed stable so animation is smooth.
        const seed = hash(`${e.id}_${i}${particleType === "standard" ? "_" + Math.floor(time * 20) : ""}`);
        const spawnT = e.startTime + (i / total) * e.duration;
        const age = time - spawnT;
        if (age < 0 || age > lifespan) continue;
        const path = particlePath(particleType, seed, w, h, padding, age, lifespan);
        if (!path) continue;
        const baseRot = pseudo(seed, 3) * 360;
        const rotation = baseRot + rotSpeed * age;
        const sizeMul = 1 + (pseudo(seed, 4) - 0.5) * 2 * sizeJitter;
        const size = Math.max(2, cfg.size * sizeMul);
        const color = PRESET_COLOR_FNS[cfg.preset]?.(i, cfg.color) ?? cfg.color;
        detParticles.push({
          key: `${e.id}_${i}`,
          x: path.x,
          y: path.y,
          size,
          color,
          opacity: path.opacity,
          rotation,
          shape,
          scale: path.scale ?? 1,
        });
      }
    }
  }
  }

  // Each render, recompute live particle visuals from their birth time.
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
      {detParticles.map(({ key, ...s }) => (
        <Particle key={key} {...s} />
      ))}
      {liveParticles.map((s) => {
        const age = nowMs - s.bornAtMs;
        const t01 = Math.min(1, Math.max(0, age / s.lifespanMs));
        const opacity = t01 < 0.5 ? t01 * 2 : 2 - t01 * 2;
        const rotation = s.baseRotation + s.rotationSpeed * (age / 1000);
        return (
          <Particle
            key={`live_${s.id}`}
            x={s.x}
            y={s.y}
            size={s.size}
            color={s.color}
            opacity={opacity}
            rotation={rotation}
            shape={s.shape}
            scale={1}
          />
        );
      })}
    </span>
  );
}

function Particle({
  x,
  y,
  size,
  color,
  opacity,
  rotation,
  shape = "star",
  scale = 1,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  rotation: number;
  shape?: ParticleShape;
  scale?: number;
}) {
  const d = (PARTICLE_SHAPES as Record<string, string>)[shape] ?? PARTICLE_SHAPES.star;
  const effectiveSize = size * scale;
  return (
    <svg
      width={effectiveSize}
      height={effectiveSize}
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: x - effectiveSize / 2,
        top: y - effectiveSize / 2,
        opacity,
        transform: `rotate(${rotation}deg)`,
        pointerEvents: "none",
      }}
    >
      <path d={d} fill={color} />
    </svg>
  );
}


