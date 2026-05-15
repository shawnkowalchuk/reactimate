import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Component, Effect, Project, TypewriterShape } from "../../types/project";
import type { RegisterElement, RegisterShape } from "../../playback/useAnimationEngine";
import { usePlaybackStore } from "../../store/playbackStore";
import { useSpotlightStore } from "../../store/spotlightStore";
import { TintLayer } from "./TintLayer";
import { ParticleOverlay } from "./ParticleOverlay";
import { FireworksLibraryOverlay } from "./FireworksLibraryOverlay";

interface Segment {
  kind: "plain" | "component" | "overlay";
  text: string;
  component?: Component;
  key: string;
}

/**
 * Split layer text into segments in text order. The first component in a
 * range renders inline; components that lie entirely within already-covered
 * text become overlay segments that stack on top via absolute positioning.
 * Effects from overlapped components still apply (collected later).
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
    const start = c.startIndex;
    const end = Math.min(text.length, c.endIndex);
    if (end <= start) continue;

    if (start > cursor) {
      out.push({
        kind: "plain",
        text: text.slice(cursor, start),
        key: `plain_${cursor}`,
      });
      cursor = start;
    }

    const isOverlay = end <= cursor;
    out.push({
      kind: isOverlay ? "overlay" : "component",
      text: text.slice(start, end),
      component: c,
      key: `comp_${c.id}`,
    });

    if (!isOverlay) cursor = end;
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
  registerShape: RegisterShape;
  /** Canvas frame ref (for span-position measurement in TintLayer). */
  frameRef: RefObject<HTMLDivElement | null>;
}

/** Find the typewriter shape config on a component, if any. */
function shapeOf(c: Component): TypewriterShape | undefined {
  for (const e of c.effects) {
    if (e.type === "typewriter" && e.typewriter?.shape) return e.typewriter.shape;
  }
  return undefined;
}

/** Inline styles for a per-letter shape span (size/blur/opacity set by engine). */
function shapeSpanStyle(shape: TypewriterShape): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    zIndex: shape.layer === "front" ? 2 : 0,
    backgroundColor: shape.color,
    borderRadius: shape.type === "circle" ? "50%" : 0,
    width: 0,
    height: 0,
    opacity: 0,
    visibility: "hidden",
    willChange: "width, height, opacity, filter",
  };
}

export function RenderedText({
  project,
  registerElement,
  registerShape,
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
        wordBreak: "normal",
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
      {segments.map((seg, idx, arr) => {
        if (seg.kind === "plain") {
          if (/^\s+$/.test(seg.text)) {
            return (
              <span key={seg.key} style={{ visibility: "hidden" }}>
                {seg.text}
              </span>
            );
          }
          return null;
        }
        // Overlay segments are rendered inside their preceding component's
        // wrapper — skip them here.
        if (seg.kind === "overlay") return null;

        const c = seg.component!;
        // Collect trailing overlay segments that belong to this component.
        const overlays: typeof seg[] = [];
        let j = idx + 1;
        while (j < arr.length && arr[j].kind === "overlay") {
          overlays.push(arr[j]);
          j++;
        }
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
        const fwLibraryEffects: Effect[] = [];
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
              if (e.type === "fireworks-js" && e.fireworks) {
                const end = e.startTime + e.duration;
                const active =
                  time >= e.startTime &&
                  (e.fireworks.continueAfter || time <= end);
                if (active) fwLibraryEffects.push(e);
              }
            }
          }
        }

        const hasMaskBox = c.effects.some(
          (e) =>
            e.type === "slide" &&
            e.maskBox &&
            time >= e.startTime &&
            time <= e.startTime + e.duration,
        );

        const compShape = shapeOf(c);
        const baseSpan = stagger ? (
          <span style={{ display: "inline-block" }}>
            {Array.from(seg.text).map((ch, i) => {
              const letter = (
                <span
                  ref={(el) => registerElement(`${c.id}|${i}`, el)}
                  style={
                    compShape
                      ? { ...sharedSpanStyle, position: "relative", zIndex: 1 }
                      : sharedSpanStyle
                  }
                >
                  {ch === " " ? " " : ch}
                </span>
              );
              if (!compShape) return <span key={i}>{letter}</span>;
              return (
                <span
                  key={i}
                  style={{ position: "relative", display: "inline-block" }}
                >
                  <span
                    ref={(el) => registerShape(`${c.id}|${i}`, el)}
                    aria-hidden="true"
                    style={shapeSpanStyle(compShape)}
                  />
                  {letter}
                </span>
              );
            })}
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

        const overlaySpans = overlays.map((o) => {
          const oc = o.component!;
          const oStagger = oc.effects.some(
            (e) => e.staggerLetters || e.type === "typewriter",
          );
          const oStyle = {
            display: "inline-block" as const,
            fontFamily: oc.style.fontFamily,
            fontWeight: oc.style.fontWeight,
            letterSpacing: `${oc.style.letterSpacing}px`,
            willChange: "transform, opacity",
          };
          const oShape = shapeOf(oc);
          const oSpan = oStagger ? (
            <span style={{ display: "inline-block" }}>
              {Array.from(o.text).map((ch, i) => {
                const letter = (
                  <span
                    ref={(el) => registerElement(`${oc.id}|${i}`, el)}
                    style={
                      oShape
                        ? { ...oStyle, position: "relative", zIndex: 1 }
                        : oStyle
                    }
                  >
                    {ch === " " ? " " : ch}
                  </span>
                );
                if (!oShape) return <span key={i}>{letter}</span>;
                return (
                  <span
                    key={i}
                    style={{ position: "relative", display: "inline-block" }}
                  >
                    <span
                      ref={(el) => registerShape(`${oc.id}|${i}`, el)}
                      aria-hidden="true"
                      style={shapeSpanStyle(oShape)}
                    />
                    {letter}
                  </span>
                );
              })}
            </span>
          ) : (
            <span ref={(el) => registerElement(oc.id, el)} style={oStyle}>
              {o.text}
            </span>
          );
          return (
            <span
              key={o.key}
              style={{ position: "absolute", inset: 0 }}
            >
              {oSpan}
            </span>
          );
        });

        const needsOverlayWrapper = overlays.length > 0;
        const innerWithOverlays = needsOverlayWrapper ? (
          <span style={{ position: "relative", display: "inline-block" }}>
            {inner}
            {overlaySpans}
          </span>
        ) : (
          inner
        );

        if (tintEffects.length === 0 && particleEffects.length === 0 && fwLibraryEffects.length === 0) {
          return (
            <span key={seg.key} style={{ display: "inline-block" }}>
              {innerWithOverlays}
            </span>
          );
        }

        return (
          <TintWrapper
            key={seg.key}
            text={seg.text}
            tintEffects={tintEffects}
            particleEffects={particleEffects}
            fwLibraryEffects={fwLibraryEffects}
            spotMouse={spotMouse}
            time={time}
            canvasWidth={project.canvas.width}
            canvasHeight={project.canvas.height}
            frameRef={frameRef}
          >
            {innerWithOverlays}
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
  fwLibraryEffects: Effect[];
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
  fwLibraryEffects,
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
      {fwLibraryEffects.length > 0 && (
        <FireworksLibraryOverlay
          effects={fwLibraryEffects}
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
          cy = cfg.sweepY ?? canvasHeight / 2;
        } else {
          cx = canvasWidth + cfg.size - (canvasWidth + cfg.size * 2) * t01;
          cy = cfg.sweepY ?? canvasHeight / 2;
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
        cy = cfg.sweepY ?? canvasHeight / 2;
      } else {
        cx = canvasWidth + cfg.size - (canvasWidth + cfg.size * 2) * t01;
        cy = cfg.sweepY ?? canvasHeight / 2;
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
