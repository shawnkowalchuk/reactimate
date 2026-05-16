import type { Component, Effect, TypewriterShape } from "../types/project";
import { fmt, jsxTextExpression } from "./format";

/**
 * Find the typewriter effect on a component, if any. Components can have
 * only one meaningful typewriter at a time (the engine picks the first).
 */
export function typewriterOf(c: Component): Effect | undefined {
  return c.effects.find((e) => e.type === "typewriter" && e.typewriter);
}

/**
 * Render a component with a typewriter effect as a series of per-letter
 * motion.span elements with staggered reveal delays. When the typewriter
 * also has a shape config (square/circle), each letter gets a sibling
 * motion.span behind/in-front animating size/blur/fade.
 *
 * Limitations:
 * - Other effects on the same component (slide, color-shift, etc.) are
 *   NOT folded into the per-letter spans yet — typewriter + extra effect
 *   combos only animate the typewriter reveal in the export.
 * - Line-spacing within the typed text is handled by line-height on the
 *   outer container; `\n` characters become `<br />`.
 */
export function renderTypewriterSpan(
  c: Component,
  text: string,
  effect: Effect,
): string {
  const tw = effect.typewriter!;
  const mode = tw.mode; // "snap" | "fade"
  const shape = tw.shape;
  const reverse = effect.staggerDirection === "reverse";

  // Count only RENDERABLE characters for the per-letter window math —
  // line-break characters are emitted as <br /> and don't get a slot.
  const chars = Array.from(text);
  const n = Math.max(1, chars.length);
  const perLetter = effect.duration / n;
  const fadeDur = mode === "snap" ? 0.001 : perLetter;

  const baseStyle: Record<string, unknown> = {
    fontFamily: c.style.fontFamily,
    fontSize: c.style.fontSize,
    fontWeight: c.style.fontWeight,
    letterSpacing: c.style.letterSpacing,
    color: c.style.color,
    display: "inline-block",
  };

  const letterParts: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === "\n") {
      letterParts.push(`<br key={"br_${i}"} />`);
      continue;
    }
    const idx = reverse ? n - 1 - i : i;
    const delay = Math.round((effect.startTime + perLetter * idx) * 1000) / 1000;
    const display = ch === " " ? "\\u00a0" : ch;
    const letterJsx = renderLetterSpan(baseStyle, delay, fadeDur, i, display);
    if (shape) {
      letterParts.push(renderLetterWithShape(letterJsx, shape, delay, perLetter, i));
    } else {
      letterParts.push(letterJsx);
    }
  }

  return `<span style={{ display: "inline-block" }}>
${indent(letterParts.join("\n"), "  ")}
</span>`;
}

function renderLetterSpan(
  baseStyle: Record<string, unknown>,
  delay: number,
  duration: number,
  i: number,
  ch: string,
): string {
  return `<motion.span
  key={"l_${i}"}
  style={${fmt(baseStyle, 1)}}
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ delay: ${delay}, duration: ${duration}, ease: "linear" }}
>{"${ch}"}</motion.span>`;
}

function renderLetterWithShape(
  letterJsx: string,
  shape: TypewriterShape,
  delay: number,
  perLetter: number,
  i: number,
): string {
  // Compute keyframe arrays for size / opacity / blur. When snapOff is on
  // the shape vanishes at the end of the window — represented as a 3-step
  // keyframe with the third value forced to 0 opacity.
  const sizes = [shape.sizeFrom, shape.sizeTo];
  const opacities = shape.snapOff
    ? [shape.fadeFrom, shape.fadeTo, 0]
    : [shape.fadeFrom, shape.fadeTo];
  const filters = [
    `blur(${shape.blurFrom}px)`,
    `blur(${shape.blurTo}px)`,
  ];
  const times = shape.snapOff ? [0, 0.999, 1] : undefined;

  const shapeStyle: Record<string, unknown> = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: shape.layer === "front" ? 2 : 0,
    backgroundColor: shape.color,
    borderRadius: shape.type === "circle" ? "50%" : 0,
    pointerEvents: "none",
  };

  const sizesLit = `[${sizes.join(", ")}]`;
  const opacityLit = `[${opacities.join(", ")}]`;
  const filterLit = `[${filters.map((f) => `"${f}"`).join(", ")}]`;
  const timesLit = times ? `, times: [${times.join(", ")}]` : "";

  return `<span style={{ position: "relative", display: "inline-block" }}>
  <motion.span
    key={"s_${i}"}
    style={${fmt(shapeStyle, 2)}}
    initial={{ width: ${shape.sizeFrom}, height: ${shape.sizeFrom}, opacity: ${shape.fadeFrom}, filter: "blur(${shape.blurFrom}px)" }}
    animate={{ width: ${sizesLit}, height: ${sizesLit}, opacity: ${opacityLit}, filter: ${filterLit} }}
    transition={{ delay: ${delay}, duration: ${perLetter}, ease: "linear"${timesLit} }}
  />
${indent(letterJsx, "  ")}
</span>`;
}

function indent(s: string, prefix: string): string {
  return s.split("\n").map((l) => prefix + l).join("\n");
}

// Re-export for symmetry; consumer modules tend to want it nearby.
export { jsxTextExpression };
