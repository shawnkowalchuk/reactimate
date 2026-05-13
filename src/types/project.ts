export type CanvasPreset = "16:9" | "1:1" | "9:16" | "custom";
export type Alignment = "left" | "center" | "right";

export type EffectType =
  | "fade"
  | "slide"
  | "scale"
  | "rotate"
  | "color-shift"
  | "spotlight"
  | "particle"
  | "typewriter"
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
  };
  /**
   * For "particle" effects: small star particles rendered randomly within
   * the OWNING component's text bounding box during the effect's window.
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
     * - "component" : random points inside the text bounding box
     * - "around"    : same bbox, extended outward by `rangePx` on each side
     * - "follow"    : particles spawn at the mouse cursor over the canvas
     * - "hover"     : like follow, but ONLY while the cursor is inside
     *                 the component's text bounding box
     */
    mode?: "component" | "around" | "follow" | "hover";
    /** Extra padding around the text bbox for "around" mode (design px). */
    rangePx?: number;
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
   * For "typewriter" effects: each letter reveals at
   * startTime + i*(duration/N). `mode` controls whether each letter
   * snaps in instantly or fades in over a small per-letter window.
   */
  typewriter?: {
    mode: "snap" | "fade";
  };
}

export interface Component {
  id: string;
  startIndex: number;
  endIndex: number;
  color: string;
  style: ComponentStyle;
  effects: Effect[];
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
}

export type AnimatableProp = keyof AnimatableTargets;
