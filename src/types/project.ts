export type CanvasPreset = "16:9" | "1:1" | "9:16" | "custom";
export type Alignment = "left" | "center" | "right";

export type EffectType =
  | "fade"
  | "slide"
  | "scale"
  | "rotate"
  | "color-shift"
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
