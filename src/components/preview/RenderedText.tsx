import type { Component, Project } from "../../types/project";
import type { RegisterElement } from "../../playback/useAnimationEngine";

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
}

/**
 * Renders the layer's text. Each segment is a block-level element so
 * components can have their own alignment. Plain segments inherit the
 * layer's alignment.
 */
export function RenderedText({ project, registerElement }: RenderedTextProps) {
  const segments = splitTextIntoSegments(project);
  const { defaultTextStyle, layer } = project;

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
        width: "100%",
      }}
    >
      {segments.map((seg) => {
        // Plain (non-componentized) text is hidden in the preview — only
        // explicit components participate in the animation. To make the
        // gap text visible, the user must componentize it and add an effect.
        if (seg.kind === "plain") {
          return null;
        }
        const c = seg.component!;
        // Fall back to layer alignment for components saved before the
        // per-component alignment field existed (loaded from localStorage).
        const align = c.style.alignment ?? layer.alignment;
        return (
          <div
            key={seg.key}
            style={{ textAlign: align }}
          >
            <span
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
          </div>
        );
      })}
    </div>
  );
}
