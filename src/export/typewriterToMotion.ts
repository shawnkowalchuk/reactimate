import type { Component, Effect, TypewriterShape } from "../types/project";
import { fmt, jsxTextExpression } from "./format";
import { buildComponentMotion, type ComponentMotion } from "./effectToMotion";

/**
 * Find the typewriter effect on a component, if any. Components can have
 * only one meaningful typewriter at a time (the engine picks the first).
 */
export function typewriterOf(c: Component): Effect | undefined {
  return c.effects.find((e) => e.type === "typewriter" && e.typewriter);
}

/**
 * Render a component with a typewriter effect as a series of per-letter
 * motion.span elements. Each letter carries the FULL component animation
 * for that letter index — the typewriter reveal PLUS any other effect on
 * the component (blur, slide, color-shift, …) — so a typewriter combined
 * with a second effect exports faithfully. When the typewriter also has a
 * shape config (square/circle), each letter gets a sibling motion.span
 * animating size/blur/fade.
 *
 * Line-spacing within the typed text is handled by line-height on the
 * outer container; `\n` characters become `<br />`.
 */
export function renderTypewriterSpan(
  c: Component,
  text: string,
  effect: Effect,
  totalDuration: number,
): string {
  const tw = effect.typewriter!;
  const shape = tw.shape;
  const reverse = effect.staggerDirection === "reverse";

  // Count only RENDERABLE characters for the per-letter window math —
  // line-break characters are emitted as <br /> and don't get a slot.
  const chars = Array.from(text);
  const n = Math.max(1, chars.length);
  // Per-letter slot — the optional shape animates over this window.
  const perLetter = effect.duration / n;

  const baseStyle: Record<string, unknown> = {
    fontFamily: c.style.fontFamily,
    fontSize: c.style.fontSize,
    fontWeight: c.style.fontWeight,
    letterSpacing: c.style.letterSpacing,
    display: "inline-block",
    // Anchor scale animations at the baseline so per-letter scale
    // effects (e.g. typewriter + zoom combo) collapse / expand toward
    // the line, not the line-box center. Matches the editor's
    // transformOrigin in playback/useAnimationEngine.ts.
    transformOrigin: "50% 100%",
  };
  // Color is identical for every letter — bake it in unless an effect
  // (e.g. color-shift) animates it.
  const probe = buildComponentMotion(c, totalDuration, 0, n);
  if (probe.animate.color === undefined) baseStyle.color = c.style.color;
  const styleStr = fmt(baseStyle, 1);

  const letterParts: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === "\n") {
      letterParts.push(`<br key={"br_${i}"} />`);
      continue;
    }
    // Every effect on the component, evaluated for THIS letter index —
    // the typewriter reveal is just one of them.
    const motion = buildComponentMotion(c, totalDuration, i, n);
    const display = ch === " " ? "\\u00a0" : ch;
    const letterJsx = renderLetterSpan(styleStr, motion, i, display);
    if (shape) {
      const idx = reverse ? n - 1 - i : i;
      const delay =
        Math.round((effect.startTime + perLetter * idx) * 1000) / 1000;
      letterParts.push(
        renderLetterWithShape(letterJsx, shape, delay, perLetter, i),
      );
    } else {
      letterParts.push(letterJsx);
    }
  }

  // offsetX / offsetY shift the whole typed block by a static translate
  // (used to stack duplicate components into a layered shadow / outline).
  const offX = tw.offsetX ?? 0;
  const offY = tw.offsetY ?? 0;
  const wrapStyle =
    offX !== 0 || offY !== 0
      ? `{{ display: "inline-block", transform: "translate(${offX}px, ${offY}px)" }}`
      : `{{ display: "inline-block" }}`;

  return `<span style=${wrapStyle}>
${indent(letterParts.join("\n"), "  ")}
</span>`;
}

function renderLetterSpan(
  styleStr: string,
  motion: ComponentMotion,
  i: number,
  ch: string,
): string {
  const Tag = motion.isStatic ? "span" : "motion.span";
  const lines = [`<${Tag} key={"l_${i}"}`, `  style={${styleStr}}`];
  if (!motion.isStatic) {
    lines.push(`  initial={${fmt(motion.initial, 1)}}`);
    lines.push(`  animate={${fmt(motion.animate, 1)}}`);
    lines.push(`  transition={${fmt(motion.transition, 1)}}`);
  }
  lines.push(`>{"${ch}"}</${Tag}>`);
  return lines.join("\n");
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
