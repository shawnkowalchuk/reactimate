import type { Component, Effect } from "../types/project";
import { fmt } from "./format";
import { particlePath, PARTICLE_SHAPES } from "../components/preview/particleUtils";

/** Color preset functions inlined into the export so it has no runtime deps. */
const PRESET_FN_SOURCE = `const PRESET_COLOR_FN = {
  gold: () => "#fbbf24",
  silver: () => "#e5e7eb",
  rainbow: (i) => "hsl(" + ((i * 47) % 360) + ", 90%, 60%)",
  fire: (i) => ["#fde047", "#fb923c", "#ef4444", "#f97316"][i % 4],
  custom: (_i, c) => c,
};`;

/** Inlined PARTICLE_SHAPES so the exported file renders the right SVG path. */
const PARTICLE_PATHS_SOURCE = `const PARTICLE_PATHS = ${JSON.stringify(PARTICLE_SHAPES)};`;

/**
 * Source for the shared <Particle> helper. Renders a motion.svg with the
 * shape's SVG path, centered on (x, y) via negative margins so motion's
 * own transform (x/y/scale/rotate animations) doesn't conflict with the
 * centering trick. Accepts arrays for x/y/opacity/scale/rotate so the same
 * helper drives both single-shot and looping particles.
 *
 * Note: PARTICLE_PATHS is emitted separately by `particleSharedSource` so
 * it can be reused by the CursorParticleLayer too.
 */
const PARTICLE_HELPER_SOURCE = `function Particle({ shape, color, size, x, y, opacity, scale, rotate, delay, duration, repeat, repeatDelay }) {
  const d = PARTICLE_PATHS[shape] || PARTICLE_PATHS.star;
  const half = size / 2;
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: -half,
        top: -half,
        pointerEvents: "none",
        transformOrigin: "center",
      }}
      initial={{ x: x[0], y: y[0], opacity: 0, scale: 0, rotate: rotate[0] }}
      animate={{ x, y, opacity, scale, rotate }}
      transition={Object.assign(
        { delay, duration, ease: "linear" },
        repeat ? { repeat: Infinity, repeatDelay } : {},
      )}
    >
      <path d={d} fill={color} />
    </motion.svg>
  );
}`;

/**
 * Source for the live cursor-driven particle renderer. Used by hover and
 * follow modes — both inject this component once into the exported file.
 * Lives at the module scope of the exported file (defined once, even when
 * multiple cursor-driven particle effects exist).
 *
 *  - hover : spawns only while cursor is inside `config.area` (design coords)
 *  - follow: spawns anywhere over the hero wrapper
 *
 * Coordinates are converted from viewport pixels to canvas-design pixels
 * via the wrapper's getBoundingClientRect ratio, so the spawn position
 * stays correct even if the user's site responsively scales the hero.
 */
const CURSOR_LAYER_SOURCE = `function CursorParticleLayer({ config, width, height }) {
  const shape = config.shape || "star";
  const path = PARTICLE_PATHS[shape] || PARTICLE_PATHS.star;
  const wrapRef = useRef(null);
  const [particles, setParticles] = useState([]);
  const nextIdRef = useRef(1);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let lastSpawn = 0;
    const onMove = (e) => {
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const sx = width / rect.width;
      const sy = height / rect.height;
      const x = (e.clientX - rect.left) * sx;
      const y = (e.clientY - rect.top) * sy;
      if (config.mode === "hover") {
        const a = config.area;
        if (!a) return;
        if (x < a.x || x > a.x + a.width || y < a.y || y > a.y + a.height) return;
      }
      const now = performance.now();
      const intervalMs = 1000 / Math.max(0.1, config.density);
      if (now - lastSpawn < intervalMs) return;
      lastSpawn = now;
      const jitter = config.spawnRadiusPx ?? 30;
      const sizeJitter = config.sizeJitter ?? 0.4;
      const sizeMul = 1 + (Math.random() - 0.5) * 2 * sizeJitter;
      const size = Math.max(2, (config.size ?? 16) * sizeMul);
      const fn = PRESET_COLOR_FN[config.preset] || PRESET_COLOR_FN.custom;
      const color = fn(nextIdRef.current, config.color);
      const id = nextIdRef.current++;
      setParticles((prev) => [
        ...prev,
        {
          id,
          x: x + (Math.random() - 0.5) * jitter * 2,
          y: y + (Math.random() - 0.5) * jitter * 2,
          color,
          size,
          bornAt: now,
          baseRotation: Math.random() * 360,
        },
      ]);
    };
    window.addEventListener("pointermove", onMove);
    const cull = window.setInterval(() => {
      const now = performance.now();
      const lifespanMs = (config.lifespanSec ?? 0.6) * 1000;
      setParticles((prev) => prev.filter((p) => now - p.bornAt < lifespanMs));
    }, 200);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearInterval(cull);
    };
  }, [config, width, height]);

  return (
    <div
      ref={wrapRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {particles.map((p) => {
        const half = p.size / 2;
        return (
          <motion.svg
            key={p.id}
            width={p.size}
            height={p.size}
            viewBox="0 0 24 24"
            style={{
              position: "absolute",
              left: p.x - half,
              top: p.y - half,
              pointerEvents: "none",
              transformOrigin: "center",
            }}
            initial={{ opacity: 0, scale: 0, rotate: p.baseRotation }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.5], rotate: p.baseRotation + 90 }}
            transition={{ duration: config.lifespanSec ?? 0.6, ease: "easeOut" }}
          >
            <path d={path} fill={p.color} />
          </motion.svg>
        );
      })}
    </div>
  );
}`;

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
  /** Particle shape: star / circle / diamond / square. */
  shape: string;
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
  /** Rotation in degrees over the lifespan. */
  rotate: number[];
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
    if (mode === "follow" || mode === "hover") {
      // Cursor-driven mode — render via the live <CursorParticleLayer />
      // helper that's emitted once at module scope. We bake just the
      // config object the helper needs.
      const cfgLiteral: Record<string, unknown> = {
        mode,
        density: cfg.density,
        size: cfg.size,
        color: cfg.color,
        preset: cfg.preset,
        shape: cfg.shape ?? "star",
        spawnRadiusPx: cfg.spawnRadiusPx ?? 30,
        lifespanSec: cfg.lifespanSec ?? 0.6,
        sizeJitter: cfg.sizeJitter ?? 0.4,
      };
      if (mode === "hover" && cfg.area) cfgLiteral.area = cfg.area;
      out.push(`{/* Cursor particle effect ${e.id} (mode=${mode}) */}
<CursorParticleLayer config={${JSON.stringify(cfgLiteral)}} width={CANVAS_W} height={CANVAS_H} />`);
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
    const shape = cfg.shape ?? "star";
    const rotSpeed = cfg.rotationSpeed ?? 0;

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
      const rotates: number[] = [];
      const baseRot = pseudo(seed, 3) * 360;
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
          rotates.push(rotates[rotates.length - 1] ?? baseRot);
          continue;
        }
        ok = true;
        xs.push(Math.round((area.x + path.x) * 10) / 10);
        ys.push(Math.round((area.y + path.y) * 10) / 10);
        opacities.push(Math.round(path.opacity * 100) / 100);
        scales.push(Math.round((path.scale ?? 1) * 100) / 100);
        // Per-particle rotation matches the runtime: baseRot + rotSpeed * age.
        rotates.push(Math.round((baseRot + rotSpeed * age) * 10) / 10);
      }
      if (!ok) continue;

      particles.push({
        shape,
        size: Math.round(size * 10) / 10,
        color,
        delay: Math.round(spawnT * 1000) / 1000,
        x: xs,
        y: ys,
        opacity: opacities,
        scale: scales,
        rotate: rotates,
      });
    }

    // Round-trip the particle data through `fmt` so it formats nicely.
    const dataLiteral = fmt(particles as unknown as Record<string, unknown>[], 2);

    const repeatDelaySec = continueAfter
      ? Math.max(0, totalDuration - e.startTime - lifespan)
      : 0;

    out.push(`{/* Particles for effect ${e.id} (component ${c.id}, type=${type}, shape=${shape}) */}
{${dataLiteral}.map((p, i) => (
  <Particle
    key={"fx${e.id.replace(/[^a-zA-Z0-9]/g, "")}_" + i}
    shape={p.shape}
    color={p.color}
    size={p.size}
    x={p.x}
    y={p.y}
    opacity={p.opacity}
    scale={p.scale}
    rotate={p.rotate}
    delay={p.delay}
    duration={${lifespan}}
    repeat={${continueAfter ? "true" : "false"}}
    repeatDelay={${repeatDelaySec.toFixed(2)}}
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
      if (e.type !== "particle" || !e.particle) continue;
      const mode = e.particle.mode ?? "area";
      // hover/follow modes don't need an area to be valid
      if (mode === "follow") return true;
      if (e.particle.area) return true;
    }
  }
  return false;
}

/**
 * True iff any particle effect uses cursor-driven hover or follow mode —
 * which means we need to emit the live <CursorParticleLayer /> helper +
 * the matching extra React imports (useState / useEffect / useRef).
 */
export function hasCursorParticles(components: Component[]): boolean {
  for (const c of components) {
    for (const e of c.effects) {
      if (e.type !== "particle" || !e.particle) continue;
      const mode = e.particle.mode ?? "area";
      if (mode === "follow" || mode === "hover") return true;
    }
  }
  return false;
}

/**
 * Module-scope declarations shared between Particle and CursorParticleLayer
 * helpers — PARTICLE_PATHS (the SVG shape paths) and PRESET_COLOR_FN.
 * Emitted once at the top of the file by generateReactComponent if any
 * particle effect of any kind is present.
 */
export function particleSharedSource(): string {
  return `${PARTICLE_PATHS_SOURCE}

${PRESET_FN_SOURCE}`;
}

/** The Particle keyframed helper component. Depends on PARTICLE_PATHS. */
export function particleHelperSource(): string {
  return PARTICLE_HELPER_SOURCE;
}

/** The CursorParticleLayer component + the canvas dim constants. */
export function cursorLayerSource(
  canvasWidth: number,
  canvasHeight: number,
): string {
  return `const CANVAS_W = ${canvasWidth};
const CANVAS_H = ${canvasHeight};

${CURSOR_LAYER_SOURCE}`;
}
