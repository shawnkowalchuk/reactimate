import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useSelectionStore } from "../../store/selectionStore";
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const selectComponent = useSelectionStore((s) => s.selectComponent);
  const selectedComponentId = useSelectionStore((s) =>
    s.target.kind === "component" ? s.target.componentId : null,
  );

  useLayoutEffect(() => {
    const editor = editorRef.current;
    const overlay = overlayRef.current;
    if (!editor || !overlay) return;

    let rafId = 0;
    const compute = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
      const textNode = findTextNode(editor);
      if (!textNode) {
        setGroups([]);
        return;
      }
      const overlayRect = overlay.getBoundingClientRect();
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
            top: r.top - overlayRect.top,
            left: r.left - overlayRect.left,
            width: r.width,
            height: r.height,
          })),
        };
      });

      setGroups(next);
      });
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(editor);
    window.addEventListener("resize", compute);
    if (document.fonts) {
      document.fonts.ready.then(compute).catch(() => undefined);
    }
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [editorRef, components, text]);

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
    >
      {groups.flatMap((g, gi) =>
        g.rects.map((r, i) => {
          const offset = stackOffsetFor(g, gi, groups);
          return (
            <div
              key={`${g.id}_${i}`}
              className="absolute rounded-sm"
              style={{
                top: r.top + offset,
                left: r.left + offset,
                width: r.width,
                height: r.height,
                background: "transparent",
                boxShadow: `inset 0 0 0 3px ${g.color}`,
              }}
            />
          );
        }),
      )}
      {/* Selection circle on the top-right corner of the LARGEST rect of
          each component. The largest rect skips tiny leading-whitespace
          rects that can sit on a previous wrap-line. pointer-events-auto
          opts back into clickability so the overlay stays transparent
          everywhere else. */}
      {groups.map((g, gi) => {
        if (g.rects.length === 0) return null;
        // Use the FULL bounding box so the dot sits at the top-right
        // corner of the component's entire text area, not just the
        // largest line rect.
        const bb = boundingBox(g.rects);
        const stackIdx = stackIndexFor(g, gi, groups);
        const boxOffset = stackIdx * 4;
        const dot = 14;
        const hit = 32;
        const dotGap = 4;
        const cx = bb.left + boxOffset + bb.width + stackIdx * (dot + dotGap);
        const cy = bb.top + boxOffset;
        const isSelected = g.id === selectedComponentId;
        return (
          <button
            key={`${g.id}_dot`}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectComponent(g.id)}
            title="Select component"
            aria-label="Select component"
            className="pointer-events-auto absolute flex items-center justify-center"
            style={{
              top: cy - hit / 2,
              left: cx - hit / 2,
              width: hit,
              height: hit,
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
            }}
          >
            <span
              className="block rounded-full ring-2 ring-white/80 transition-transform hover:scale-125 dark:ring-neutral-950/80"
              style={{
                width: dot,
                height: dot,
                background: g.color,
                boxShadow: isSelected
                  ? `0 0 0 2px ${g.color}, 0 0 0 4px rgba(255,255,255,0.5)`
                  : undefined,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Two rects "substantially overlap" only if their intersection area is
 * at least half of the smaller rect's area. This excludes line-adjacent
 * boxes that only share a 1-pixel y-edge — those are not duplicates.
 */
function substantialOverlap(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
): boolean {
  const ix = Math.max(
    0,
    Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left),
  );
  const iy = Math.max(
    0,
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top),
  );
  const inter = ix * iy;
  const aArea = a.width * a.height;
  const bArea = b.width * b.height;
  const smaller = Math.min(aArea, bArea);
  return smaller > 0 && inter >= 0.5 * smaller;
}

function stackIndexFor(
  g: RectGroup,
  index: number,
  all: RectGroup[],
): number {
  if (g.rects.length === 0) return 0;
  const aBox = boundingBox(g.rects);
  let count = 0;
  for (let i = 0; i < index; i++) {
    const other = all[i];
    if (other.rects.length === 0) continue;
    if (substantialOverlap(aBox, boundingBox(other.rects))) count++;
  }
  return count;
}

function stackOffsetFor(
  g: RectGroup,
  index: number,
  all: RectGroup[],
): number {
  if (g.rects.length === 0) return 0;
  const aBox = boundingBox(g.rects);
  let stackedAbove = 0;
  for (let i = 0; i < index; i++) {
    const other = all[i];
    if (other.rects.length === 0) continue;
    if (substantialOverlap(aBox, boundingBox(other.rects))) stackedAbove++;
  }
  return stackedAbove * 4;
}

function boundingBox(
  rects: Array<{ top: number; left: number; width: number; height: number }>,
): { top: number; left: number; width: number; height: number } {
  let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
  for (const r of rects) {
    if (r.left < minL) minL = r.left;
    if (r.top < minT) minT = r.top;
    if (r.left + r.width > maxR) maxR = r.left + r.width;
    if (r.top + r.height > maxB) maxB = r.top + r.height;
  }
  return { left: minL, top: minT, width: maxR - minL, height: maxB - minT };
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

