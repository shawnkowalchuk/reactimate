import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Component, Effect, Project } from "../../types/project";
import type { RegisterElement } from "../../playback/useAnimationEngine";
import { usePlaybackStore } from "../../store/playbackStore";
import { useSpotlightStore } from "../../store/spotlightStore";
import { TintLayer } from "./TintLayer";
import { ParticleOverlay } from "./ParticleOverlay";

interface Segment {
  kind: "plain" | "component";
  text: string;
  component?: Component;
  key: string;
}

/**
 * Split layer text into segments, sorted by startIndex. Overlapping
 * components are silently skipped from rendering (their text would be
 * rendered as part of the first component's slice). The duplicate's
 * effects exist in state but don't drive any DOM element.
 */
function splitTextIntoSegments(project: Project): Segment[] {
  const { text, components } = project.layer;
  const visible = components.filter((c) => !c.hidden);
  const sorted = [...visible].sort(
    (a, b) => a.startIndex - b.startIndex,
  );

  const out: Segment[] = [];
  let cursor = 0;
  for (const c of sorted) {
    const start = Math.max(cursor, c.startIndex);
    const end = Math.min(text.length, c.endIndex);
    if (start > cursor) {
      out.push({
        kind: "plain",
        text: text.slice(cursor, start),
        key: `plain_${cursor}`,
      });
    }
    if (end > start) {
      out.push({
        kind: "component",
        text: text.slice(start, end),
        component: c,
        key: `comp_${c.id}`,
      });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < text.length) {
    out.push({
      kind: "plain",
      text: text.slice(cursor),
      key: `plain_${cursor}`,
    });
  }
  return out;
}

interface RenderedTextProps {
  project: Project;
  registerElement: RegisterElement;
  /** Canvas frame ref (for span-position measurement in TintLayer). */
  frameRef: RefObject<HTMLDivElement | null>;
}

export function RenderedText({
  project,
  registerElement,
  frameRef,
}: RenderedTextProps) {
  const segments = splitTextIntoSegments(project);
  const { defaultTextStyle, layer } = project;
  const time = usePlaybackStore((s) => s.currentTime);
  const mouse = useSpotlightStore((s) => s.mouse);

  const fallback = {
    x: project.canvas.width / 2,
    y: project.canvas.height / 2,
  };
  const spotMouse = mouse ?? fallback;

  return (
    <div
      style={{
        lineHeight: layer.lineHeight,
        fontFamily: defaultTextStyle.fontFamily,
        fontSize: defaultTextStyle.fontSize,
        fontWeight: defaultTextStyle.fontWeight,
        color: defaultTextStyle.color,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        textAlign: layer.alignment,
        width: "100%",
        // Cap text width so long phrases naturally wrap to multiple
        // lines (similar to the previous behavior). For explicit line
        // breaks the user can insert a newline (\n) in the text.
        maxWidth: `${Math.round(project.canvas.width * 0.55)}px`,
        margin: "0 auto",
        cursor: "default",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {segments.map((seg) => {
        if (seg.kind === "plain") {
          // Only preserve plain WHITESPACE (spaces between componentized
          // words). Plain non-whitespace characters (e.g. the "e" of
          // "reactimat[e]" if the user hasn't componentized that letter)
          // are hidden entirely so they don't leave a phantom gap in the
          // visible flow.
          if (/^\s+$/.test(seg.text)) {
            return (
              <span key={seg.key} style={{ visibility: "hidden" }}>
                {seg.text}
              </span>
            );
          }
          return null;
        }
        const c = seg.component!;
        // Per-letter rendering kicks in for any effect using staggerLetters
        // OR any typewriter effect (which auto-staggers per character).
        const stagger = c.effects.some(
          (e) => e.staggerLetters || e.type === "typewriter",
        );
        const sharedSpanStyle = {
          display: "inline-block" as const,
          fontFamily: c.style.fontFamily,
          fontWeight: c.style.fontWeight,
          letterSpacing: `${c.style.letterSpacing}px`,
          willChange: "transform, opacity",
        };

        // Aggregate active tint AND particle effects from this component
        // AND any other component whose range OVERLAPS this rendered
        // segment. Overlapping components (duplicates) only render visually
        // via the first one, but their effects still apply on top of it.
        const tintEffects: Effect[] = [];
        const particleEffects: Effect[] = [];
        for (const other of project.layer.components) {
          if (other.hidden) continue;
          if (
            other.startIndex < c.endIndex &&
            other.endIndex > c.startIndex
          ) {
            for (const e of other.effects) {
              if (isActiveTint(e, time)) tintEffects.push(e);
              if (e.type === "particle" && e.particle) {
                const end = e.startTime + e.duration;
                const active =
                  time >= e.startTime &&
                  (e.particle.continueAfter || time <= end);
                if (active) particleEffects.push(e);
              }
            }
          }
        }

        const hasMaskBox = c.effects.some(
          (e) => e.type === "slide" && e.maskBox,
        );

        const baseSpan = stagger ? (
          <span style={{ display: "inline-block" }}>
            {Array.from(seg.text).map((ch, i) => (
              <span
                key={i}
                ref={(el) => registerElement(`${c.id}|${i}`, el)}
                style={sharedSpanStyle}
              >
                {ch === " " ? " " : ch}
              </span>
            ))}
          </span>
        ) : (
          <span
            ref={(el) => registerElement(c.id, el)}
            style={sharedSpanStyle}
          >
            {seg.text}
          </span>
        );

        const inner = hasMaskBox ? (
          <span
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "bottom",
            }}
          >
            {baseSpan}
          </span>
        ) : (
          baseSpan
        );

        if (tintEffects.length === 0 && particleEffects.length === 0) {
          return (
            <span key={seg.key} style={{ display: "inline-block" }}>
              {inner}
            </span>
          );
        }

        return (
          <TintWrapper
            key={seg.key}
            text={seg.text}
            tintEffects={tintEffects}
            particleEffects={particleEffects}
            spotMouse={spotMouse}
            time={time}
            canvasWidth={project.canvas.width}
            canvasHeight={project.canvas.height}
            frameRef={frameRef}
          >
            {inner}
          </TintWrapper>
        );
      })}
    </div>
  );
}

/** Returns true iff `effect` is a maskText spotlight active at `time`. */
function isActiveTint(effect: Effect, time: number): boolean {
  if (effect.type !== "spotlight") return false;
  if (!effect.spotlight?.maskText) return false;
  const end = effect.startTime + effect.duration;
  return time >= effect.startTime && time <= end;
}

interface TintWrapperProps {
  text: string;
  tintEffects: Effect[];
  particleEffects: Effect[];
  spotMouse: { x: number; y: number };
  time: number;
  canvasWidth: number;
  canvasHeight: number;
  frameRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

function TintWrapper({
  text,
  tintEffects,
  particleEffects,
  spotMouse,
  time,
  canvasWidth,
  canvasHeight,
  frameRef,
  children,
}: TintWrapperProps) {
  // Split spotlights by maskMode. "tint" = recolor inside (TintLayer);
  // "reveal" = mask the base text so it's only visible inside the spot.
  const reveals = tintEffects.filter(
    (e) => e.spotlight?.maskMode === "reveal",
  );
  const tints = tintEffects.filter(
    (e) => e.spotlight?.maskMode !== "reveal",
  );

  // For reveal-mode, we need to apply a mask to the base text. To do
  // that we need the wrapper's offset relative to the canvas frame
  // (same trick as TintLayer). Use a child <span> that we measure.
  return (
    <RevealMaskWrapper
      revealEffects={reveals}
      spotMouse={spotMouse}
      time={time}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      frameRef={frameRef}
    >
      {children}
      {particleEffects.length > 0 && (
        <ParticleOverlay
          effects={particleEffects}
          time={time}
          frameRef={frameRef}
        />
      )}
      {tints.map((e) => {
        const cfg = e.spotlight!;
        const t01 = e.duration <= 0 ? 1 : (time - e.startTime) / e.duration;
        let cx: number;
        let cy: number;
        if (cfg.motion === "mouse") {
          cx = spotMouse.x;
          cy = spotMouse.y;
        } else if (cfg.motion === "sweep-left") {
          cx = -cfg.size + (canvasWidth + cfg.size * 2) * t01;
          cy = canvasHeight / 2;
        } else {
          cx = canvasWidth + cfg.size - (canvasWidth + cfg.size * 2) * t01;
          cy = canvasHeight / 2;
        }
        return (
          <TintLayer
            key={e.id}
            text={text}
            color={cfg.color}
            spotPos={{ x: cx, y: cy }}
            size={cfg.size}
            shape={cfg.shape}
            featherPx={cfg.featherPx ?? 0}
            frameRef={frameRef}
          />
        );
      })}
    </RevealMaskWrapper>
  );
}

interface RevealMaskWrapperProps {
  revealEffects: Effect[];
  spotMouse: { x: number; y: number };
  time: number;
  canvasWidth: number;
  canvasHeight: number;
  frameRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

function RevealMaskWrapper({
  revealEffects,
  spotMouse,
  time,
  canvasWidth,
  canvasHeight,
  frameRef,
  children,
}: RevealMaskWrapperProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [, setLayoutTick] = useState(0);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const frame = frameRef.current;
    if (!wrap || !frame) return;
    const compute = () => {
      const w = wrap.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      const designWidth = parseFloat(frame.style.width || "0") || f.width;
      const scale = designWidth > 0 ? f.width / designWidth : 1;
      const safeScale = Math.max(0.0001, scale);
      offsetRef.current = {
        x: (w.left - f.left) / safeScale,
        y: (w.top - f.top) / safeScale,
      };
      setLayoutTick((t) => t + 1);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [frameRef]);

  // Build mask CSS for active reveal-mode spotlights.
  let maskCss: string | undefined;
  if (revealEffects.length > 0) {
    const layers: string[] = [];
    for (const e of revealEffects) {
      const cfg = e.spotlight!;
      const t01 = e.duration <= 0 ? 1 : (time - e.startTime) / e.duration;
      let cx: number;
      let cy: number;
      if (cfg.motion === "mouse") {
        cx = spotMouse.x;
        cy = spotMouse.y;
      } else if (cfg.motion === "sweep-left") {
        cx = -cfg.size + (canvasWidth + cfg.size * 2) * t01;
        cy = canvasHeight / 2;
      } else {
        cx = canvasWidth + cfg.size - (canvasWidth + cfg.size * 2) * t01;
        cy = canvasHeight / 2;
      }
      const lx = cx - offsetRef.current.x;
      const ly = cy - offsetRef.current.y;
      const feather = cfg.featherPx ?? 0;
      const innerStop = Math.max(0, cfg.size - feather);
      if (cfg.shape === "circle") {
        layers.push(
          `radial-gradient(${cfg.size}px at ${lx}px ${ly}px, black ${innerStop}px, transparent ${cfg.size}px)`,
        );
      } else {
        layers.push(
          `linear-gradient(black, black) ${lx - cfg.size}px ${ly - cfg.size}px / ${cfg.size * 2}px ${cfg.size * 2}px no-repeat`,
        );
      }
    }
    maskCss = layers.join(", ");
  }

  return (
    <span
      ref={wrapRef}
      style={{
        position: "relative",
        display: "inline-block",
        maskImage: maskCss,
        WebkitMaskImage: maskCss,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    >
      {children}
    </span>
  );
}
