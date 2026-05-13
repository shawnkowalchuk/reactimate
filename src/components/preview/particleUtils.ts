import type { Effect } from "../../types/project";

export type ParticleShape = NonNullable<Effect["particle"]>["shape"];

export const PARTICLE_SHAPES: Record<NonNullable<ParticleShape>, string> = {
  star: "M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z",
  circle: "M12 0 A12 12 0 1 1 12 24 A12 12 0 1 1 12 0",
  diamond: "M12 0 L23 12 L12 24 L1 12 Z",
  square: "M3 3 H21 V21 H3 Z",
};

export const PRESET_COLOR_FNS: Record<
  NonNullable<Effect["particle"]>["preset"],
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

export interface ParticleResult {
  x: number;
  y: number;
  opacity: number;
  /** Optional scale factor beyond the base size (for explosion flash). */
  scale?: number;
}

/**
 * Per-type particle physics. Returns position + opacity for a single
 * particle at `age` seconds into its lifespan, or null if not visible.
 */
export function particlePath(
  type: NonNullable<NonNullable<Effect["particle"]>["type"]>,
  seed: number,
  w: number,
  h: number,
  padding: number,
  age: number,
  lifespan: number,
): ParticleResult | null {
  const t01 = Math.min(1, lifespan > 0 ? age / lifespan : 1);

  if (type === "standard") {
    const minX = -padding;
    const minY = -padding;
    const rangeX = w + padding * 2;
    const rangeY = h + padding * 2;
    // Gentle drift around the spawn point.
    const sx = minX + pseudo(seed, 1) * rangeX;
    const sy = minY + pseudo(seed, 2) * rangeY;
    const driftX = Math.sin(t01 * Math.PI * 2 + pseudo(seed, 3) * 10) * 6;
    const driftY = Math.cos(t01 * Math.PI * 2 + pseudo(seed, 3) * 10) * 4;
    const opacity = t01 < 0.5 ? t01 * 2 : 2 - t01 * 2;
    return { x: sx + driftX, y: sy + driftY, opacity };
  }

  if (type === "fireworks") {
    // Two phases: rocket ascent (0 → 0.3) then explosion burst (0.3 → 1.0).
    // Each "particle" is either a trail spark during ascent or a burst
    // fragment after explosion.
    const burstTime = 0.25 + pseudo(seed, 0) * 0.15; // explosion at 25-40%
    const isTrail = t01 < burstTime;
    const cx = w / 2;

    if (isTrail) {
      // Rocket trail: ascend from near-bottom with slight horizontal wobble.
      const launchX = cx + (pseudo(seed, 1) - 0.5) * w * 0.5;
      const launchY = h + padding;
      const rocketHeight = h * (0.5 + pseudo(seed, 2) * 0.4);
      const ascentT = t01 / burstTime; // 0→1 during ascent
      const wobble = Math.sin(ascentT * 8 + seed) * 4;
      const x = launchX + wobble;
      const y = launchY - ascentT * rocketHeight;
      const opacity = (1 - ascentT) * 0.6; // fade trail
      return { x, y, opacity, scale: 0.5 };
    }

    // Burst phase: particles radiate from explosion point with gravity.
    const burstT = (t01 - burstTime) / (1 - burstTime); // 0→1 after explosion
    const launchX = cx + (pseudo(seed, 1) - 0.5) * w * 0.5;
    const launchY = h + padding;
    const rocketHeight = h * (0.5 + pseudo(seed, 2) * 0.4);
    const ex = launchX;
    const ey = launchY - rocketHeight;
    const angle = pseudo(seed, 3) * Math.PI * 2;
    const speed = 60 + pseudo(seed, 4) * 180;
    const gravity = 350;
    const dist = speed * burstT;
    const x = ex + Math.cos(angle) * dist;
    const y = ey + Math.sin(angle) * dist + gravity * burstT * burstT;
    // Flash bright then fade.
    let opacity: number;
    if (burstT < 0.1) opacity = burstT / 0.1;
    else opacity = Math.max(0, 1 - (burstT - 0.1) / 0.9);
    const scale = burstT < 0.05 ? 1.5 - burstT * 10 : 1;
    return { x, y, opacity, scale };
  }

  if (type === "volcano") {
    // Fountain: particles shoot up from bottom with random spread,
    // arc under gravity, fall back down.
    const cx = w / 2;
    const spawnSpread = w * 0.25;
    const spawnX = cx + (pseudo(seed, 1) - 0.5) * 2 * spawnSpread;
    const spawnY = h + 4;
    const upVel = 180 + pseudo(seed, 2) * 140;
    const horizDrift = (pseudo(seed, 5) - 0.5) * 80;
    const gravity = 500;
    const x = spawnX + horizDrift * age;
    const y = spawnY - upVel * age + 0.5 * gravity * age * age;
    let opacity = 1;
    if (t01 < 0.15) opacity = t01 / 0.15;
    else if (t01 > 0.65) opacity = Math.max(0, (1 - t01) / 0.35);
    return { x, y, opacity, scale: 1 - t01 * 0.4 };
  }

  if (type === "dropping") {
    // Cascade: particles spawn above the bbox and fall through.
    const spawnX = pseudo(seed, 1) * w;
    const spawnY = -(padding + 20 + pseudo(seed, 2) * 40);
    const fallVel = 100 + pseudo(seed, 5) * 120;
    const drift = (pseudo(seed, 6) - 0.5) * 40;
    const gravity = 250;
    const x = spawnX + drift * age;
    const y = spawnY + fallVel * age + 0.5 * gravity * age * age;
    let opacity = 1;
    if (t01 < 0.15) opacity = t01 / 0.15;
    else if (t01 > 0.7) opacity = Math.max(0, (1 - t01) / 0.3);
    return { x, y, opacity, scale: 0.9 + Math.sin(t01 * 2) * 0.1 };
  }

  return null;
}

export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pseudo(seed: number, k: number): number {
  let t = (seed + k * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
