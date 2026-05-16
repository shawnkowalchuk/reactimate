import type { Component, Effect } from "../types/project";
import { fmt } from "./format";

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

interface ExportedParticle {
  /** Canvas-design X (px). */
  x: number;
  /** Canvas-design Y (px). */
  y: number;
  /** Diameter in px. */
  size: number;
  /** CSS color. */
  color: string;
  /** Time the particle first appears (seconds). */
  delay: number;
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
    if (type !== "standard") {
      out.push(
        `{/* Particle effect ${e.id} type="${type}" — only "standard" type\n    is currently exportable. Physics types (fireworks/volcano/dropping)\n    are previewed in the editor but the exporter just emits a static\n    spread; skipped. */}`,
      );
      continue;
    }
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

    // Deterministically generate `density * duration` particles spread
    // across the effect window, each at a stable position inside `area`.
    const total = Math.max(1, Math.round(density * e.duration));
    const particles: ExportedParticle[] = [];
    for (let i = 0; i < total; i++) {
      const seed = hash(`${e.id}_${i}`);
      const px = area.x + pseudo(seed, 1) * area.width;
      const py = area.y + pseudo(seed, 2) * area.height;
      const sizeMul = 1 + (pseudo(seed, 4) - 0.5) * 2 * sizeJitter;
      const size = Math.max(2, sizeBase * sizeMul);
      const color = colorFn(i, cfg.color);
      // Spread spawn times evenly across the effect window.
      const spawnT = e.startTime + (i / total) * e.duration;
      particles.push({
        x: Math.round(px),
        y: Math.round(py),
        size: Math.round(size * 10) / 10,
        color,
        delay: Math.round(spawnT * 1000) / 1000,
      });
    }

    // Round-trip the particle data through `fmt` so it formats nicely.
    const dataLiteral = fmt(particles as unknown as Record<string, unknown>[], 2);

    // The transition uses a repeat strategy: when continueAfter is set
    // we repeat forever; otherwise the particle plays once and stays
    // invisible after its window.
    const repeatExpr = continueAfter
      ? `repeat: Infinity, repeatDelay: ${Math.max(0, totalDuration - e.startTime - lifespan).toFixed(2)}`
      : `repeat: 0`;

    out.push(`{/* Particles for effect ${e.id} (component ${c.id}) */}
{${dataLiteral}.map((p, i) => (
  <motion.div
    key={"fx${e.id.replace(/[^a-zA-Z0-9]/g, "")}_" + i}
    style={{
      position: "absolute",
      left: p.x,
      top: p.y,
      width: p.size,
      height: p.size,
      backgroundColor: p.color,
      borderRadius: "50%",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
    }}
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.5] }}
    transition={{
      delay: p.delay,
      duration: ${lifespan},
      ease: "easeOut",
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
        (e.particle.mode ?? "area") === "area" &&
        (e.particle.type ?? "standard") === "standard"
      ) {
        return true;
      }
    }
  }
  return false;
}
