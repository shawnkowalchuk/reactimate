import type { Component, Project } from "../types/project";
import { buildComponentMotion } from "./effectToMotion";
import { fmt, jsxTextExpression } from "./format";
import {
  buildParticleLayers,
  cursorLayerSource,
  hasCursorParticles,
  hasExportableParticles,
  particleHelperSource,
  particleSharedSource,
} from "./particleToMotion";
import { renderTypewriterSpan, typewriterOf } from "./typewriterToMotion";
import { buildFireworksExport } from "./fireworksToMotion";
import {
  buildSpotlightExport,
  hasMaskTextSpotlight,
  maskedTextHelperSource,
  maskTextSpotlightOf,
  sweepStartEnd,
} from "./spotlightToMotion";

interface Segment {
  kind: "plain" | "component";
  text: string;
  component?: Component;
}

function splitTextIntoSegments(project: Project): Segment[] {
  const { text, components } = project.layer;
  const sorted = [...components].sort((a, b) => a.startIndex - b.startIndex);
  const out: Segment[] = [];
  let cursor = 0;
  for (const c of sorted) {
    const s = Math.max(cursor, c.startIndex);
    const e = Math.min(text.length, c.endIndex);
    if (s > cursor) out.push({ kind: "plain", text: text.slice(cursor, s) });
    if (e > s) out.push({ kind: "component", text: text.slice(s, e), component: c });
    cursor = e;
  }
  if (cursor < text.length) {
    out.push({ kind: "plain", text: text.slice(cursor) });
  }
  return out;
}

function renderComponentSpan(c: Component, content: string, totalDuration: number): string {
  const motion = buildComponentMotion(c, totalDuration);
  const Tag = motion.isStatic ? "span" : "motion.span";

  const baseStyle: Record<string, unknown> = {
    fontFamily: c.style.fontFamily,
    fontSize: c.style.fontSize,
    fontWeight: c.style.fontWeight,
    letterSpacing: c.style.letterSpacing,
    display: "inline-block",
  };
  // If color isn't animated, bake it into style. If it IS animated,
  // it'll appear in initial/animate and Motion drives it.
  if (motion.animate.color === undefined) {
    baseStyle.color = c.style.color;
  }

  const lines: string[] = [`<${Tag}`];
  lines.push(`  style={${fmt(baseStyle, 1)}}`);

  if (!motion.isStatic) {
    lines.push(`  initial={${fmt(motion.initial, 1)}}`);
    lines.push(`  animate={${fmt(motion.animate, 1)}}`);
    lines.push(`  transition={${fmt(motion.transition, 1)}}`);
  }

  lines.push(`>${jsxTextExpression(content)}</${Tag}>`);
  return lines.join("\n");
}

function indent(s: string, prefix: string): string {
  return s
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

/**
 * Wrap a component's rendered text JSX with the <MaskedText> helper so a
 * spotlight beam can recolor it (tint mode) or cut it out (reveal mode).
 * Passes only what the helper needs — the spotlight cfg, the canvas
 * width for offset math, and the sweep start/end for non-mouse modes.
 */
function wrapWithMaskedText(
  innerJsx: string,
  c: import("../types/project").Component,
  effect: import("../types/project").Effect,
  canvasWidth: number,
  canvasHeight: number,
): string {
  const cfg = effect.spotlight!;
  const mode = cfg.maskMode ?? "tint";
  // Helper only needs the position-relevant fields of the spotlight cfg.
  const helperCfg = {
    shape: cfg.shape,
    size: cfg.size,
    motion: cfg.motion,
  };
  const baseStyle = {
    fontFamily: c.style.fontFamily,
    fontSize: c.style.fontSize,
    fontWeight: c.style.fontWeight,
    letterSpacing: c.style.letterSpacing,
    color: c.style.color,
    display: "inline-block",
  };
  const se = sweepStartEnd(cfg, canvasWidth, canvasHeight);
  const startProp = se ? `sweepStart={${JSON.stringify(se.start)}}` : "";
  const endProp = se ? `sweepEnd={${JSON.stringify(se.end)}}` : "";
  return `<MaskedText
  cfg={${JSON.stringify(helperCfg)}}
  canvasWidth={${canvasWidth}}
  startTime={${effect.startTime}}
  duration={${effect.duration}}
  baseStyle={${fmt(baseStyle as unknown as Record<string, unknown>, 1)}}
  tintColor={${JSON.stringify(cfg.color)}}
  mode={${JSON.stringify(mode)}}
  ${startProp}
  ${endProp}
>
${indent(innerJsx, "  ")}
</MaskedText>`;
}

export function generateReactComponent(project: Project): string {
  const segments = splitTextIntoSegments(project);

  const inner = segments
    .map((seg) => {
      if (seg.kind === "plain") return jsxTextExpression(seg.text);
      const c = seg.component!;
      // If the component has a typewriter effect, replace the single
      // motion.span with per-letter spans (staggered reveal, optional
      // per-letter shape).
      const tw = typewriterOf(c);
      let spanJsx = tw
        ? renderTypewriterSpan(c, seg.text, tw)
        : renderComponentSpan(c, seg.text, project.duration);
      // If a spotlight on this component asks to mask the text, wrap
      // the rendered span in a <MaskedText> helper that clips it (or
      // overlays a tinted copy) following the spotlight position.
      const maskEffect = maskTextSpotlightOf(c);
      if (maskEffect) {
        spanJsx = wrapWithMaskedText(
          spanJsx,
          c,
          maskEffect,
          project.canvas.width,
          project.canvas.height,
        );
      }
      return spanJsx;
    })
    .join("\n");

  // Particles + fireworks render at canvas-design coordinates absolutely
  // positioned inside the wrapper — so the wrapper needs position: relative
  // when any of these layers is being emitted.
  const hasParticles = hasExportableParticles(project.layer.components);
  const particleBlocks = project.layer.components.flatMap((c) =>
    buildParticleLayers(c, project.duration),
  );
  const fireworks = buildFireworksExport(
    project.layer.components,
    project.canvas.width,
    project.canvas.height,
  );
  const hasFireworks = fireworks !== null;
  const needsCursorParticles = hasCursorParticles(project.layer.components);
  const spotlight = buildSpotlightExport(
    project.layer.components,
    project.canvas.width,
    project.canvas.height,
  );
  const hasSpotlight = spotlight !== null;
  const needsMaskedText = hasMaskTextSpotlight(project.layer.components);

  const wrapperStyle: Record<string, unknown> = {
    width: project.canvas.width,
    height: project.canvas.height,
    background: project.canvas.background,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: project.defaultTextStyle.fontFamily,
    color: project.defaultTextStyle.color,
    fontSize: project.defaultTextStyle.fontSize,
    fontWeight: project.defaultTextStyle.fontWeight,
  };
  if (hasParticles || hasFireworks || needsCursorParticles || hasSpotlight) wrapperStyle.position = "relative";

  const innerStyle = {
    textAlign: project.layer.alignment,
    lineHeight: project.layer.lineHeight,
    whiteSpace: "pre-wrap",
  };

  const particleSection = particleBlocks.length > 0
    ? "\n" + indent(particleBlocks.join("\n"), "      ")
    : "";
  const fireworksSection = fireworks
    ? "\n" + indent(fireworks.layerJsx.join("\n"), "      ")
    : "";
  const spotlightSection = spotlight
    ? "\n" + indent(spotlight.layerJsx.join("\n"), "      ")
    : "";

  const imports = ['import { motion } from "motion/react";'];
  // Helper modules each declare what extra imports they need, but the
  // React imports overlap (fireworks needs useEffect/useRef, spotlight
  // mouse needs useEffect/useRef/useState, masked text adds
  // useLayoutEffect). We consolidate every hook into ONE React import
  // so the exported file never has duplicate import lines.
  const reactHooks = new Set<string>();
  if (fireworks) reactHooks.add("useEffect").add("useRef");
  if (spotlight && spotlight.extraImports.length > 0) {
    reactHooks.add("useEffect").add("useRef").add("useState");
  }
  if (needsCursorParticles) {
    reactHooks.add("useEffect").add("useRef").add("useState");
  }
  if (needsMaskedText) {
    reactHooks.add("useEffect").add("useLayoutEffect").add("useRef").add("useState");
  }
  // Pull non-React extra imports from each helper (e.g. fireworks-js).
  const extraNonReact: string[] = [];
  if (fireworks) extraNonReact.push(...fireworks.extraImports.filter((s) => !s.includes(`from "react"`)));
  if (spotlight) extraNonReact.push(...spotlight.extraImports.filter((s) => !s.includes(`from "react"`)));
  imports.push(...extraNonReact);
  if (reactHooks.size > 0) {
    const ordered = ["useEffect", "useLayoutEffect", "useRef", "useState"].filter(
      (h) => reactHooks.has(h),
    );
    imports.push(`import { ${ordered.join(", ")} } from "react";`);
  }
  const uniqueImports = Array.from(new Set(imports));

  const helperParts: string[] = [];
  // Shared particle declarations (PARTICLE_PATHS + PRESET_COLOR_FN) come
  // first if either keyframed or cursor particles are present. Both
  // helpers reference these at module scope.
  if (hasParticles || needsCursorParticles) {
    helperParts.push(particleSharedSource());
  }
  if (hasParticles) helperParts.push(particleHelperSource());
  if (needsCursorParticles) {
    helperParts.push(
      cursorLayerSource(project.canvas.width, project.canvas.height),
    );
  }
  if (fireworks) helperParts.push(fireworks.helperComponent);
  if (spotlight?.helperComponent) helperParts.push(spotlight.helperComponent);
  if (needsMaskedText) helperParts.push(maskedTextHelperSource());
  const helpers = helperParts.length > 0 ? "\n" + helperParts.join("\n\n") + "\n" : "";

  return `${uniqueImports.join("\n")}
${helpers}
export function Hero() {
  return (
    <div style={${fmt(wrapperStyle, 3)}}>
      <div style={${fmt(innerStyle, 4)}}>
${indent(inner, "        ")}
      </div>${particleSection}${fireworksSection}${spotlightSection}
    </div>
  );
}
`;
}

export const __testing = { splitTextIntoSegments, renderComponentSpan };
