export type CanvasPreset = "16:9" | "1:1" | "9:16" | "custom";
export type Alignment = "left" | "center" | "right";

export type EffectType =
  | "fade"
  | "slide"
  | "rotate"
  | "color-shift"
  | "spotlight"
  | "particle"
  | "typewriter"
  | "blur"
  | "zoom"
  | "fireworks-js"
  | "custom";

export type EasingType =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "spring"
  | "bounce";

export interface AnimatableTargets {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  color?: string;
  fontSize?: number;
  blur?: number;
}

export interface ComponentStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  letterSpacing: number;
  /** Per-component text alignment for the preview; renders each component as a block. */
  alignment: Alignment;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  rotation: number;
  blur: number;
}

export interface Effect {
  id: string;
  type: EffectType;
  startTime: number;
  duration: number;
  easing: EasingType;
  /** End-of-effect values (the "to" side of each animated property). */
  targets: AnimatableTargets;
  /**
   * Optional explicit start values. When undefined for a given prop,
   * the engine falls back to the previous effect's target (or the
   * component's base style for the first effect).
   */
  from?: AnimatableTargets;
  /**
   * When true, the effect plays per-character with `staggerDelay`
   * seconds offset between each letter. The component is rendered as
   * one span per character so each can be animated independently.
   */
  staggerLetters?: boolean;
  /** Delay between each letter (seconds). Defaults to 0.05 if undefined. */
  staggerDelay?: number;
  /**
   * Direction of the per-letter stagger:
   *  - "forward" (default) : first character animates first
   *  - "reverse"           : last character animates first
   *
   * Applies to both `staggerLetters` effects and `typewriter` effects.
   */
  staggerDirection?: "forward" | "reverse";
  /** For slide effects: mask the text within its original bounding box so it slides in from behind a window. */
  maskBox?: boolean;
  /**
   * Loop the effect. 0 / undefined = play once (default). N > 0 = play
   * N+1 times total (matches motion's `repeat` semantics — repeat: 3
   * means 1 initial play + 3 repeats = 4 total). Number.POSITIVE_INFINITY
   * = loop forever.
   *
   * Skipped for `particle` and `fireworks-js` — those have their own
   * `continueAfter` flag that loops the SPAWNER continuously, which
   * does the right thing for particle-style effects.
   */
  repeat?: number;
  /** Seconds between loop cycles when `repeat` is set. 0 = continuous. */
  repeatDelay?: number;
  /**
   * For "spotlight" effects: a colored shape rendered behind the text
   * during the effect's [startTime, startTime + duration] window.
   *
   * Motion modes:
   *  - "mouse"      → follows the cursor in the preview canvas
   *  - "sweep-left" → sweeps left-to-right across the canvas linearly
   *  - "sweep-right"→ sweeps right-to-left across the canvas linearly
   */
  spotlight?: {
    shape: "circle" | "square";
    /** px in canvas-design coords. Radius for circle, half-side for square. */
    size: number;
    color: string;
    opacity: number;
    motion: "mouse" | "sweep-left" | "sweep-right";
    /**
     * When true, mask the OWNING component's text relative to the
     * spotlight shape. `maskMode` decides how:
     *  - "tint":   text always visible in default color; recolored to
     *              spotlight color where the beam touches it.
     *  - "reveal": text only visible WHERE the beam touches it; outside
     *              the beam the text is hidden.
     */
    maskText?: boolean;
    maskMode?: "tint" | "reveal";
    /** Soft-edge feather in design px. 0 = hard edge. */
    featherPx?: number;
    /** Show the colored backdrop shape. Defaults to true. */
    showBackdrop?: boolean;
    /**
     * Y position in design px for sweep modes when sweepStart/End aren't set.
     * Defaults to canvas height / 2.
     */
    sweepY?: number;
    /**
     * Explicit start position (design coords) for sweep modes. When set
     * with sweepEnd, overrides the mode-based off-canvas defaults so
     * users can sweep diagonally or partially across the canvas.
     */
    sweepStart?: { x: number; y: number };
    /** Explicit end position (design coords) for sweep modes. */
    sweepEnd?: { x: number; y: number };
  };
  /**
   * For "particle" effects: small star particles spawned within the
   * effect's `area` rectangle during its time window.
   */
  particle?: {
    /** Particles spawned per second. */
    density: number;
    /** Star size in design px. */
    size: number;
    /** When preset = "custom", the single CSS color used for all stars. */
    color: string;
    preset: "gold" | "silver" | "rainbow" | "fire" | "custom";
    /** Particle shape: star, circle, diamond, or square. */
    shape?: "star" | "circle" | "diamond" | "square";
    /**
     * Particle behavior preset:
     *  - "standard" : random in bbox, gentle drift (default)
     *  - "fireworks": rocket launch + explosion burst
     *  - "volcano"  : fountain spray upward from bottom
     *  - "dropping" : cascade down from above the bbox
     */
    type?: "standard" | "fireworks" | "volcano" | "dropping";
    /**
     * Spawn placement:
     *  - "area"   : random points inside `area` (default)
     *  - "follow" : particles spawn at the mouse cursor over the canvas
     *  - "hover"  : like follow, but ONLY while the cursor is inside `area`
     */
    mode?: "area" | "follow" | "hover";
    /** Spawn rectangle in canvas DESIGN coords (px). Required for "area"/"hover" modes. */
    area?: EffectArea;
    /** Px jitter from the cursor when spawning in follow/hover modes. */
    spawnRadiusPx?: number;
    /** Per-particle lifetime in seconds (overrides auto-derived value). */
    lifespanSec?: number;
    /** ± fraction of `size` to jitter per particle (0 = none, 0.5 = ±50%). */
    sizeJitter?: number;
    /** Degrees per second a particle rotates while alive (0 = no spin). */
    rotationSpeed?: number;
    /** When true, particles keep spawning after the effect's [start,end] ends. */
    continueAfter?: boolean;
  };
  /**
   * For "fireworks-js" effects: canvas-based fireworks engine by
   * crashmax-dev (MIT). Renders via fireworks-js library.
   * https://github.com/crashmax-dev/fireworks-js
   *
   * Density controls particle count, Size controls explosion scale.
   * Preview-only — not exported to Motion JSX.
   */
  fireworks?: {
    /** Particles per burst (fireworks-js `particles` option). */
    density: number;
    /** Explosion intensity 1-20 (fireworks-js `explosion`). */
    explosion: number;
    /** Gravity strength (fireworks-js `gravity`, default 1.5). */
    gravity?: number;
    /** Particle opacity 0-1 (fireworks-js `opacity`). */
    opacity?: number;
    /** Particle flickering 0-100 (fireworks-js `flickering`). */
    flickering?: number;
    /** Acceleration 1.0-1.1 (fireworks-js `acceleration`). */
    acceleration?: number;
    /** Friction 0.9-1.0 (fireworks-js `friction`). */
    friction?: number;
    /** Trace length 1-10 (fireworks-js `traceLength`). */
    traceLength?: number;
    /** Trace speed 1-20 (fireworks-js `traceSpeed`). */
    traceSpeed?: number;
    /** Launch intensity 10-100 (fireworks-js `intensity`). */
    intensity?: number;
    /** Line cap style: round or square. */
    lineStyle?: "round" | "square";
    /**
     * "Click to launch" — when true, clicking the preview canvas spawns
     * a firework at the click position. Backed by fireworks-js `mouse.click`.
     */
    followMouse?: boolean;
    /**
     * "Follow cursor" — when true, fireworks continuously target the cursor
     * as it moves over the preview canvas. Backed by fireworks-js `mouse.move`.
     */
    followCursor?: boolean;
    /** Rocket explosion target rectangle in canvas DESIGN coords (px). */
    area?: EffectArea;
    /** Inter-burst delay min (ms). */
    delayMin?: number;
    /** Inter-burst delay max (ms). */
    delayMax?: number;
    /** Brightness min (0-100). */
    brightnessMin?: number;
    /** Brightness max (0-100). */
    brightnessMax?: number;
    /** Decay min (0.005-0.05). */
    decayMin?: number;
    /** Decay max (0.005-0.05). */
    decayMax?: number;
    /** Hue min (0-360). */
    hueMin?: number;
    /** Hue max (0-360). */
    hueMax?: number;
    /** Rockets point min (0-100 % of canvas). */
    rocketsPointMin?: number;
    /** Rockets point max (0-100 % of canvas). */
    rocketsPointMax?: number;
    /** Line width explosion min (px, 1-10). */
    lineWidthExpMin?: number;
    /** Line width explosion max (px, 1-10). */
    lineWidthExpMax?: number;
    /** Line width trace min (px, 1-5). */
    lineWidthTraceMin?: number;
    /** Line width trace max (px, 1-5). */
    lineWidthTraceMax?: number;
    /** When true, keep launching after effect end. */
    continueAfter?: boolean;
  };
  /**
   * For "typewriter" effects: each letter reveals at
   * startTime + i*(duration/N). `mode` controls whether each letter
   * snaps in instantly or fades in over a small per-letter window.
   * `shape` (optional) renders a per-letter square or circle that
   * animates Size / Blur / Fade over the same per-letter window,
   * either behind or in front of the letter glyph.
   * `offsetX` / `offsetY` shift ALL the rendered letters by a static
   * px translate (in canvas-design coords) — useful for stacking
   * duplicate components offset from each other to create a layered
   * shadow / outline look.
   */
  typewriter?: {
    mode: "snap" | "fade";
    shape?: TypewriterShape;
    offsetX?: number;
    offsetY?: number;
  };
}

/**
 * A rectangle in canvas DESIGN coordinates (px relative to project.canvas).
 * Used by particle and fireworks effects to define their spawn / target area
 * — NOT a hard clip, just the seed region for spawn positions.
 */
export interface EffectArea {
  /** Top-left corner X (px). */
  x: number;
  /** Top-left corner Y (px). */
  y: number;
  /** Width in design px. */
  width: number;
  /** Height in design px. */
  height: number;
}

/**
 * Per-letter visual element for the typewriter effect. Each letter
 * gets its own shape centered on its glyph, animated over the
 * letter's individual reveal window (duration / N). Holds at the
 * `*To` values after the window ends — set `fadeTo: 0` if you want
 * it to disappear post-reveal.
 */
export interface TypewriterShape {
  type: "square" | "circle";
  /** z-index relative to the letter glyph. */
  layer: "front" | "behind";
  /** CSS color used for the shape fill. */
  color: string;
  /** Pixel size at start / end of each letter's reveal window. */
  sizeFrom: number;
  sizeTo: number;
  /** CSS blur (px) at start / end. */
  blurFrom: number;
  blurTo: number;
  /** Opacity 0..1 at start / end. */
  fadeFrom: number;
  fadeTo: number;
  /**
   * When true, the shape snaps to opacity 0 the instant each letter's
   * reveal window ends (overriding `fadeTo`). Useful for shapes that
   * fade in during the reveal then vanish, leaving only the letter.
   */
  snapOff?: boolean;
}

export interface Component {
  id: string;
  startIndex: number;
  endIndex: number;
  color: string;
  style: ComponentStyle;
  effects: Effect[];
  hidden?: boolean;
}

export interface Layer {
  id: string;
  text: string;
  components: Component[];
  alignment: Alignment;
  lineHeight: number;
}

export interface Project {
  id: string;
  name: string;
  duration: number;
  canvas: {
    preset: CanvasPreset;
    width: number;
    height: number;
    background: string;
  };
  defaultTextStyle: {
    fontFamily: string;
    fontSize: number;
    color: string;
    fontWeight: number;
  };
  layer: Layer;
}

export interface ComputedStyle {
  opacity: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: string;
  fontSize: number;
  blur: number;
}

export type AnimatableProp = keyof AnimatableTargets;
