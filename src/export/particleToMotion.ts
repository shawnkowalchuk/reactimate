import type { Component, Effect } from "../types/project";
import { fmt } from "./format";
import { particlePath } from "../components/preview/particleUtils";

const PRESET_COLOR_FNS: Record<
  NonNullable<Effect["particle"]>["preset"],
  (i: number, custom: string) => string
> = {
  gold: () => "#fbbf24",
  silver: () => "#e5e7eb",
  rainbow: (i) => `hsl(${(i * 47) % 360}, 90%, 60%)`,
  fire: (i) => ["#fde047", "#fb923c", "#ef4444", "#f97316"][i % 4]!,
  custom: (_i, custom) => custom,
};

/**
 * Deterministic hash used to seed per-particle randomization, mirroring
 * the runtime ParticleOverlay so the exported positions look similar.
 */
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

interface ExportedParticleKeyframed {
  /** Diameter in px. */
  size: number;
  /** CSS color. */
  color: string;
  /** Time the particle first appears (seconds). */
  delay: number;
  /** Canvas-design X keyframes (px) sampled over the lifespan. */
  x: number[];
  /** Canvas-design Y keyframes (px) sampled over the lifespan. */
  y: number[];
  /** Opacity keyframes 0..1 sampled over the lifespan. */
  opacity: number[];
  /** Scale keyframes (used by fireworks for the bright flash). */
  scale: number[];
}

/**
 * Build a particle layer's JSX for a component's particle effect. Only
 * the "area" mode with "standard" type is supported in the exporter —
 * physics-driven types (fireworks/volcano/dropping) and cursor-driven
 * modes (follow/hover) are noted with a TODO comment and skipped.
 */
export function buildParticleLayers(
  c: Component,
  totalDuration: number,
): string[] {
  const out: string[] = [];
  for (const e of c.effects) {
    if (e.type !== "particle" || !e.particle) continue;
    const cfg = e.particle;
    const mode = cfg.mode ?? "area";
    if (mode !== "area") {
      out.push(
        `{/* Particle effect ${e.id} mode="${mode}" — only "area" mode is\n    currently exportable. Other modes track the cursor and need a\n    runtime listener; skipped. */}`,
      );
      continue;
    }
    const type = cfg.type ?? "standard";
    if (!cfg.area) {
      out.push(`{/* Particle effect ${e.id} has no area — skipped. */}`);
      continue;
    }
    const area = cfg.area;
    const density = Math.max(0.1, cfg.density);
    const lifespan = cfg.lifespanSec ?? 0.6;
    const sizeJitter = cfg.sizeJitter ?? 0.4;
    const sizeBase = cfg.size;
    const colorFn = PRESET_COLOR_FNS[cfg.preset] ?? PRESET_COLOR_FNS.custom;
    const continueAfter = Boolean(cfg.continueAfter);

    // Sample N points along each particle's lifespan and emit them as
    // motion keyframes. 10 samples is enough for visually-smooth physics
    // (fireworks burst, volcano arc, dropping fall) without bloating the
    // file. For standard type the path barely moves so 4 samples suffice.
    const SAMPLES = type === "standard" ? 4 : 10;

    // Deterministically generate `density * duration` particles spread
    // across the effect window. Fireworks type spawns more visible
    // particles per burst, so we boost the count to match the preview.
    const multiplier = type === "fireworks" ? 8 : 1;
    const total = Math.max(1, Math.round(density * e.duration * multiplier));

    const particles: ExportedParticleKeyframed[] = [];
    for (let i = 0; i < total; i++) {
      const seed = hash(`${e.id}_${i}`);
      const sizeMul = 1 + (pseudo(seed, 4) - 0.5) * 2 * sizeJitter;
      const size = Math.max(2, sizeBase * sizeMul);
      const color = colorFn(i, cfg.color);
      const spawnT = e.startTime + (i / total) * e.duration;

      // Sample the particle's trajectory.
      const xs: number[] = [];
      const ys: number[] = [];
      const opacities: number[] = [];
      const scales: number[] = [];
      let ok = false;
      for (let s = 0; s < SAMPLES; s++) {
        const t = s / (SAMPLES - 1);
        const age = t * lifespan;
        const path = particlePath(type, seed, area.width, area.height, 0, age, lifespan);
        if (!path) {
          // Path can return null for trail particles outside their phase.
          // Fall back to the last successful position with opacity 0.
          xs.push(xs[xs.length - 1] ?? 0);
          ys.push(ys[ys.length - 1] ?? 0);
          opacities.push(0);
          scales.push(scales[scales.length - 1] ?? 0);
          continue;
        }
        ok = true;
        xs.push(Math.round((area.x + path.x) * 10) / 10);
        ys.push(Math.round((area.y + path.y) * 10) / 10);
        opacities.push(Math.round(path.opacity * 100) / 100);
        scales.push(Math.round((path.scale ?? 1) * 100) / 100);
      }
      if (!ok) continue;

      particles.push({
        size: Math.round(size * 10) / 10,
        color,
        delay: Math.round(spawnT * 1000) / 1000,
        x: xs,
        y: ys,
        opacity: opacities,
        scale: scales,
      });
    }

    // Round-trip the particle data through `fmt` so it formats nicely.
    const dataLiteral = fmt(particles as unknown as Record<string, unknown>[], 2);

    // When continueAfter is on we repeat forever after the per-particle
    // window; otherwise the particle plays once and disappears.
    const repeatExpr = continueAfter
      ? `repeat: Infinity, repeatDelay: ${Math.max(0, totalDuration - e.startTime - lifespan).toFixed(2)}`
      : `repeat: 0`;

    out.push(`{/* Particles for effect ${e.id} (component ${c.id}, type=${type}) */}
{${dataLiteral}.map((p, i) => (
  <motion.div
    key={"fx${e.id.replace(/[^a-zA-Z0-9]/g, "")}_" + i}
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: p.size,
      height: p.size,
      backgroundColor: p.color,
      borderRadius: "50%",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
    }}
    initial={{ x: p.x[0], y: p.y[0], opacity: 0, scale: 0 }}
    animate={{ x: p.x, y: p.y, opacity: p.opacity, scale: p.scale }}
    transition={{
      delay: p.delay,
      duration: ${lifespan},
      ease: "linear",
      ${repeatExpr},
    }}
  />
))}`);
  }
  return out;
}

/**
 * True iff the project contains at least one exportable particle layer.
 * Used by generateReactComponent to decide whether to add
 * `position: relative` to the wrapper.
 */
export function hasExportableParticles(
  components: Component[],
): boolean {
  for (const c of components) {
    for (const e of c.effects) {
      if (
        e.type === "particle" &&
        e.particle?.area &&
        (e.particle.mode ?? "area") === "area"
      ) {
        return true;
      }
    }
  }
  return false;
}
