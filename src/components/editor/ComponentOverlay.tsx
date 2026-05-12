import { useLayoutEffect, useState, type RefObject } from "react";
import type { Component } from "../../types/project";

interface OverlayProps {
  editorRef: RefObject<HTMLDivElement | null>;
  components: Component[];
  /** Pass the current text so the overlay recomputes when it changes. */
  text: string;
}

interface RectGroup {
  id: string;
  color: string;
  rects: Array<{ top: number; left: number; width: number; height: number }>;
}

/**
 * Draws colored highlight boxes on top of componentized character
 * ranges inside the contenteditable. Uses DOM Range + getClientRects()
 * so the highlights track word-wrap correctly.
 *
 * Recomputes on resize and whenever components or text change.
 */
export function ComponentOverlay({ editorRef, components, text }: OverlayProps) {
  const [groups, setGroups] = useState<RectGroup[]>([]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const compute = () => {
      const textNode = findTextNode(editor);
      if (!textNode) {
        setGroups([]);
        return;
      }
      const editorRect = editor.getBoundingClientRect();
      const scrollLeft = editor.scrollLeft;
      const scrollTop = editor.scrollTop;
      const textLen = textNode.textContent?.length ?? 0;

      const next: RectGroup[] = components.map((c) => {
        const start = clamp(c.startIndex, 0, textLen);
        const end = clamp(c.endIndex, 0, textLen);
        if (end <= start) {
          return { id: c.id, color: c.color, rects: [] };
        }
        const range = document.createRange();
        try {
          range.setStart(textNode, start);
          range.setEnd(textNode, end);
        } catch {
          return { id: c.id, color: c.color, rects: [] };
        }
        const clientRects = Array.from(range.getClientRects());
        return {
          id: c.id,
          color: c.color,
          rects: clientRects.map((r) => ({
            top: r.top - editorRect.top + scrollTop,
            left: r.left - editorRect.left + scrollLeft,
            width: r.width,
            height: r.height,
          })),
        };
      });

      setGroups(next);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(editor);
    window.addEventListener("resize", compute);
    // Also recompute after fonts may have loaded async (Google Fonts).
    if (document.fonts) {
      document.fonts.ready.then(compute).catch(() => undefined);
    }
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [editorRef, components, text]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
    >
      {groups.flatMap((g) =>
        g.rects.map((r, i) => (
          <div
            key={`${g.id}_${i}`}
            className="absolute rounded-sm"
            style={{
              top: r.top,
              left: r.left,
              width: r.width,
              height: r.height,
              background: withAlpha(g.color, 0.18),
              boxShadow: `inset 0 0 0 1.5px ${g.color}`,
            }}
          />
        )),
      )}
    </div>
  );
}

function findTextNode(host: HTMLElement): Text | null {
  for (let n = host.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === Node.TEXT_NODE) return n as Text;
  }
  return null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Add an alpha component to a CSS color. Works for `hsl(h, s%, l%)`
 * (our palette format) and `#rrggbb` / `rgb(...)`. For unknown formats
 * we fall back to the original color (overlay box just looks solid).
 */
function withAlpha(color: string, alpha: number): string {
  const hsl = color.match(/^hsl\(([^)]+)\)$/i);
  if (hsl) return `hsla(${hsl[1]}, ${alpha})`;
  const rgb = color.match(/^rgb\(([^)]+)\)$/i);
  if (rgb) return `rgba(${rgb[1]}, ${alpha})`;
  return color;
}
