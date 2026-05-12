import { Fragment } from "react";
import type { Component, Project } from "../../types/project";
import type { RegisterElement } from "../../playback/useAnimationEngine";

interface Segment {
  kind: "plain" | "component";
  text: string;
  component?: Component;
  key: string;
}

function splitTextIntoSegments(project: Project): Segment[] {
  const { text, components } = project.layer;
  const sorted = [...components].sort(
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
    cursor = end;
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
}

/**
 * Renders the layer's text. Componentized ranges are wrapped in
 * `<span>`s whose refs are registered with the animation engine,
 * which drives them via direct DOM writes during playback.
 *
 * Un-componentized text uses the layer's default text style.
 */
export function RenderedText({ project, registerElement }: RenderedTextProps) {
  const segments = splitTextIntoSegments(project);
  const { defaultTextStyle, layer } = project;

  return (
    <div
      style={{
        textAlign: layer.alignment,
        lineHeight: layer.lineHeight,
        fontFamily: defaultTextStyle.fontFamily,
        fontSize: defaultTextStyle.fontSize,
        fontWeight: defaultTextStyle.fontWeight,
        color: defaultTextStyle.color,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {segments.map((seg) => {
        if (seg.kind === "plain") {
          return <Fragment key={seg.key}>{seg.text}</Fragment>;
        }
        const c = seg.component!;
        return (
          <span
            key={seg.key}
            ref={(el) => registerElement(c.id, el)}
            style={{
              display: "inline-block",
              fontFamily: c.style.fontFamily,
              fontWeight: c.style.fontWeight,
              letterSpacing: `${c.style.letterSpacing}px`,
              willChange: "transform, opacity",
            }}
          >
            {seg.text}
          </span>
        );
      })}
    </div>
  );
}
