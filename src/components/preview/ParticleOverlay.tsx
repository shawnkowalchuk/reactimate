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
  baseRotation: number;
  bornAtMs: number;
  color: string;
  size: number;
  lifespanMs: number;
  rotationSpeed: number;
  shape: ParticleShape;
  particleType: NonNullable<Effect["particle"]>["type"];
  seed: number;
  spawnCX: number;
  spawnCY: number;
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
  // Fallback: if wrapper not measured, use frame dimensions.
  const useW = w > 0 ? w : 800;
  const useH = h > 0 ? h : 200;
  const liveCandidates = effects.filter((e) => {
    if (e.type !== "particle" || !e.particle) return false;
    if (time < e.startTime) return false;
    if (!e.particle.continueAfter && time > e.startTime + e.duration) return false;
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
      // (cursor + its persistent offset). For non-standard types, apply
      // particle-type velocity + gravity so each type has distinct motion.
      const chase = 0.12;
      const b = bboxRef.current;
      const vw = Math.max(b.w, 160);
      const vh = Math.max(b.h, 80);
      setLiveParticles((prev) =>
        prev
          .filter((s) => now - s.bornAtMs < s.lifespanMs)
          .map((s) => {
            const ageSec = (now - s.bornAtMs) / 1000;
            const lifespan = s.lifespanMs / 1000;
            const path = particlePath(s.particleType ?? "standard", s.seed, vw, vh, 0, ageSec, lifespan);
            let px = s.spawnCX;
            let py = s.spawnCY;
            if (path) {
              px = s.spawnCX + (path.x - vw / 2);
              py = s.spawnCY + (path.y - vh / 2);
            }
            if (m) {
              const cx = m.x - bbox.ox;
              const cy = m.y - bbox.oy;
              px += (cx - px) * chase;
              py += (cy - py) * chase;
            }
            return { ...s, x: px, y: py };
          }),
      );
      for (const e of candidatesRef.current) {
        const cfg = e.particle!;
        // For "hover" mode the cursor must be inside the effect's `area`
        // (canvas-design coords). Mouse `m` is also in canvas-design coords
        // (per spotlightStore), so no offset translation needed.
        let allowed = false;
        if (cfg.mode === "follow") {
          allowed = m != null;
        } else if (cfg.mode === "hover" && cfg.area && m != null) {
          allowed =
            m.x >= cfg.area.x &&
            m.x <= cfg.area.x + cfg.area.width &&
            m.y >= cfg.area.y &&
            m.y <= cfg.area.y + cfg.area.height;
        }
        if (!allowed) continue;
        const intervalMs = 1000 / Math.max(0.1, cfg.density);
        const last = lastSpawn[e.id] ?? 0;
        if (now - last >= intervalMs && m) {
          const cfg = e.particle!;
          const sizeJitter = cfg.sizeJitter ?? 0.4;
          const shape = cfg.shape ?? "star";
          const pType = cfg.type ?? "standard";
          const colorFn = PRESET_COLOR_FNS[cfg.preset];
          const color = colorFn(nextIdRef.current, cfg.color);
          const sizeMul = 1 + (Math.random() - 0.5) * 2 * sizeJitter;
          const size = Math.max(2, cfg.size * sizeMul);
          const seed = hash(`${e.id}_live_${nextIdRef.current}`);
          setLiveParticles((prev) => [
            ...prev,
            {
              id: nextIdRef.current++,
              x: m.x - bbox.ox,
              y: m.y - bbox.oy,
              baseRotation: Math.random() * 360,
              bornAtMs: now,
              color,
              size,
              lifespanMs: (cfg.lifespanSec ?? 0.6) * 1000,
              rotationSpeed: cfg.rotationSpeed ?? 0,
              shape,
              particleType: pType,
              seed,
              spawnCX: m.x - bbox.ox,
              spawnCY: m.y - bbox.oy,
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

  // Build deterministic particles for area mode (default). Particles spawn
  // within `cfg.area` (canvas-design coords). The overlay is mounted as a
  // child of the component wrapper; we subtract the wrapper's offset
  // (sizeRef.ox/oy) at render-time so x/y resolve to wrapper-local pixels.
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
  const renderOffset = sizeRef.current; // { ox, oy } subtract for wrapper-local coords
  for (const e of effects) {
    if (e.type !== "particle" || !e.particle) continue;
    const cfg = e.particle;
    if (cfg.mode === "follow" || cfg.mode === "hover") continue;
    const end = e.startTime + e.duration;
    if (time < e.startTime) continue;
    if (!cfg.continueAfter && time > end) continue;
    const lifespan = cfg.lifespanSec ?? 0.6;
    // Spawn inside `area` if defined; otherwise fall back to wrapper bbox.
    const area = cfg.area;
    const areaW = area ? area.width : useW;
    const areaH = area ? area.height : useH;
    const areaOX = area ? area.x - renderOffset.ox : 0;
    const areaOY = area ? area.y - renderOffset.oy : 0;
    const padding = 0;
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
      const cyclesSince = Math.floor((time - end) / lifespan);
      const eSeed = hash(e.id);
      const gwX = particleType !== "standard" ? Math.sin(time * 0.4 + eSeed) * 40 + Math.cos(time * 0.65 + eSeed + 1) * 30 : 0;
      const gwY = 0;
      for (let cycle = cyclesSince - 1; cycle <= cyclesSince; cycle++) {
        if (cycle < 0) continue;
        const anchor = end + cycle * lifespan;
        for (let i = 0; i < total; i++) {
          const spawnT = anchor + (i / total) * lifespan;
          const age = time - spawnT;
          if (age < 0 || age > lifespan) continue;
          const seed = hash(`${e.id}_cont_${i}_c${cycle}${particleType === "standard" ? "_" + Math.floor(time * 20) : ""}`);
          const path = particlePath(particleType, seed, areaW, areaH, padding, age, lifespan);
          if (!path) continue;
          const px = path.x + gwX + areaOX;
          const py = path.y + gwY + areaOY;
          const baseRot = pseudo(seed, 3) * 360;
          const rotation = baseRot + rotSpeed * age;
          const sizeMul = 1 + (pseudo(seed, 4) - 0.5) * 2 * sizeJitter;
          const size = Math.max(2, cfg.size * sizeMul);
          const color = PRESET_COLOR_FNS[cfg.preset]?.(i, cfg.color) ?? cfg.color;
          detParticles.push({
            key: `${e.id}_cont_${cycle}_${i}`,
            x: px,
            y: py,
            size,
            color,
            opacity: path.opacity,
            rotation,
            shape,
            scale: path.scale ?? 1,
          });
        }
      }
    } else {
      const multiplier = particleType === "fireworks" ? 8 : 1;
      const total = Math.max(1, Math.round(cfg.density * e.duration * multiplier));
      const eSeed = hash(e.id);
      const gwX = particleType !== "standard" ? Math.sin(time * 0.4 + eSeed) * 40 + Math.cos(time * 0.65 + eSeed + 1) * 30 : 0;
      const gwY = 0;
      for (let i = 0; i < total; i++) {
        const seed = hash(`${e.id}_${i}${particleType === "standard" ? "_" + Math.floor(time * 20) : ""}`);
        const spawnT = e.startTime + (i / total) * e.duration;
        const age = time - spawnT;
        if (age < 0 || age > lifespan) continue;
        const path = particlePath(particleType, seed, areaW, areaH, padding, age, lifespan);
        if (!path) continue;
        const px = path.x + gwX + areaOX;
        const py = path.y + gwY + areaOY;
        const baseRot = pseudo(seed, 3) * 360;
        const rotation = baseRot + rotSpeed * age;
        const sizeMul = 1 + (pseudo(seed, 4) - 0.5) * 2 * sizeJitter;
        const size = Math.max(2, cfg.size * sizeMul);
        const color = PRESET_COLOR_FNS[cfg.preset]?.(i, cfg.color) ?? cfg.color;
        detParticles.push({
          key: `${e.id}_${i}`,
          x: px,
          y: py,
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

  // Each render, recompute live particle visuals from their birth time.
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  void renderTick;

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
        let opacity: number;
        if (s.particleType === "volcano" || s.particleType === "dropping") {
          if (t01 < 0.15) opacity = t01 / 0.15;
          else if (t01 > 0.65) opacity = Math.max(0, (1 - t01) / 0.35);
          else opacity = 1;
        } else {
          opacity = t01 < 0.5 ? t01 * 2 : 2 - t01 * 2;
        }
        const rotation = s.baseRotation + s.rotationSpeed * (age / 1000);
        const scale = s.particleType === "volcano" ? 1 - t01 * 0.3 : 1;
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
            scale={scale}
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
  // Small drop-shadow glow makes particles read at small sizes (a 4px
  // gold star otherwise looks like a single muddy pixel against dark
  // text). Glow color = particle color, half-size blur. Negligible perf
  // cost since SVG filter is GPU-accelerated by the browser.
  const glowR = Math.max(1, effectiveSize * 0.4);
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
        filter: `drop-shadow(0 0 ${glowR.toFixed(1)}px ${color})`,
      }}
    >
      <path d={d} fill={color} />
    </svg>
  );
}


