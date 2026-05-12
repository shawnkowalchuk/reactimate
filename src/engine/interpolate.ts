import { parseColor, rgbToString } from "../utils/colors";

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function lerpColor(from: string, to: string, t: number): string {
  const a = parseColor(from);
  const b = parseColor(to);
  return rgbToString({
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  });
}

export function lerpProperty(
  prop: string,
  from: unknown,
  to: unknown,
  t: number,
): unknown {
  if (prop === "color") {
    return lerpColor(from as string, to as string, t);
  }
  return lerp(from as number, to as number, t);
}
