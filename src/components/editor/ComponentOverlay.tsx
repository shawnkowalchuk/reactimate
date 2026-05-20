import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useSelectionStore } from "../../store/selectionStore";
import type { Component } from "../../types/project";
import { charOffsetToPoint } from "./editorDom";

interface OverlayProps {
  editorRef: RefObject<HTMLDivElement | null>;
  components: Component[];
  text: string;
}

interface CompBox {
  id: string;
  color: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Renders colored highlight boxes and selection dots on top of
 * componentized text in the editor. Each box is the union of every
 * line rect a component's text occupies, so multi-line components are
 * fully enclosed.
 */
export function ComponentOverlay({ editorRef, components, text }: OverlayProps) {
  const [boxes, setBoxes] = useState<CompBox[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const selectComponent = useSelectionStore((s) => s.selectComponent);
  const selectedComponentId = useSelectionStore((s) =>
    s.target.kind === "component" ? s.target.componentId : null,
  );

  useLayoutEffect(() => {
    const editor = editorRef.current;
    const overlay = overlayRef.current;
    if (!editor || !overlay) return;

    const compute = () => {
      const fullText = editor.textContent ?? "";
      const textLen = fullText.length;
      if (textLen === 0) {
        setBoxes([]);
        return;
      }
      const overlayRect = overlay.getBoundingClientRect();

      const next: CompBox[] = [];
      for (const c of components) {
        let start = Math.max(0, Math.min(c.startIndex, textLen));
        let end = Math.max(start, Math.min(c.endIndex, textLen));
        // Skip leading and trailing whitespace (especially \n) so a
        // component whose range happens to include the newline separator
        // before / after it doesn't blow up the bbox across two lines.
        while (start < end && /\s/.test(fullText[start] ?? "")) start++;
        while (end > start && /\s/.test(fullText[end - 1] ?? "")) end--;
        if (end <= start) continue;
        // The editor renders componentized text as styled spans, so a
        // character offset can land inside any descendant text node —
        // resolve both ends through the span tree.
        const a = charOffsetToPoint(editor, start);
        const b = charOffsetToPoint(editor, end);
        const range = document.createRange();
        try {
          range.setStart(a.node, a.offset);
          range.setEnd(b.node, b.offset);
        } catch {
          continue;
        }
        // Union every line rect so a component whose text wraps onto
        // multiple lines gets a box enclosing ALL of them — not just the
        // single largest line.
        const r = unionRects(Array.from(range.getClientRects()));
        if (!r) continue;
        next.push({
          id: c.id,
          color: c.color,
          top: r.top - overlayRect.top,
          left: r.left - overlayRect.left,
          width: r.width,
          height: r.height,
        });
      }

      setBoxes(next);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(editor);
    // The editor rebuilds its DOM imperatively (styled spans) on every
    // model change — watch for that so the boxes track font-size /
    // text edits even when the editor's own box size doesn't change.
    const mo = new MutationObserver(compute);
    mo.observe(editor, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener("resize", compute);
    if (document.fonts) {
      document.fonts.ready.then(compute).catch(() => undefined);
    }
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [editorRef, components, text]);

  const dot = 14;
  const hit = 32;
  const dotGap = 4;

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
    >
      {boxes.map((b, idx) => {
        // Count how many earlier boxes share the same text range
        // (same position + size), so duplicates get only a dot.
        let dupIdx = 0;
        for (let i = 0; i < idx; i++) {
          const prev = boxes[i];
          if (
            Math.abs(prev.left - b.left) < 2 &&
            Math.abs(prev.top - b.top) < 2 &&
            Math.abs(prev.width - b.width) < 2 &&
            Math.abs(prev.height - b.height) < 2
          ) {
            dupIdx++;
          }
        }
        const isDup = dupIdx > 0;
        const isSelected = b.id === selectedComponentId;

        return (
          <div key={b.id}>
            {/* Only the first occurrence of a text range gets a box */}
            {!isDup && (
              <div
                className="absolute rounded-sm"
                style={{
                  top: b.top - 2,
                  left: b.left - 2,
                  width: b.width + 4,
                  height: b.height + 4,
                  boxShadow: `inset 0 0 0 3px ${b.color}`,
                }}
              />
            )}
            {/* Dot at top-right corner of the FIRST occurrence's box */}
            {/* For duplicates, dots line up horizontally beside the first dot */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectComponent(b.id)}
              title="Select component"
              className="pointer-events-auto absolute flex items-center justify-center"
              style={{
                top: b.top - hit / 2 - 2,
                left: b.left + b.width - dupIdx * (dot + dotGap) - hit / 2 + 2,
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
                  background: b.color,
                  boxShadow: isSelected
                    ? `0 0 0 2px ${b.color}, 0 0 0 4px rgba(255,255,255,0.5)`
                    : undefined,
                }}
              />
            </button>
          </div>
        );
      })}
      {boxes.length === 0 && components.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
          (editor out of sync — type something)
        </div>
      )}
    </div>
  );
}

/**
 * Union all client rects into the smallest box that encloses them,
 * after dropping degenerate line-edge fragments — the near-zero-width
 * slivers browsers emit when a range starts or ends at a line boundary.
 * For a component whose text wraps onto multiple lines this returns the
 * box covering every line; the highlight then includes the upper line,
 * not just whichever single line happened to be widest.
 */
function unionRects(rects: DOMRect[]): DOMRect | null {
  const solid = rects.filter((r) => r.width > 0.5 && r.height > 0.5);
  const use = solid.length > 0 ? solid : rects;
  if (use.length === 0) return null;
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const r of use) {
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return new DOMRect(left, top, right - left, bottom - top);
}
