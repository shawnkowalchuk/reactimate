export type CanvasPreset = "16:9" | "1:1" | "9:16";
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
  targets: AnimatableTargets;
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
