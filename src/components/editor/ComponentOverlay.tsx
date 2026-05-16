import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useSelectionStore } from "../../store/selectionStore";
import type { Component } from "../../types/project";

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
 * componentized text in the editor. Uses Range.getBoundingClientRect()
 * (single rect per component) for reliable positioning.
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
      const textNode = findTextNode(editor);
      if (!textNode) {
        setBoxes([]);
        return;
      }
      const overlayRect = overlay.getBoundingClientRect();
      const textLen = textNode.textContent?.length ?? 0;

      const sel = window.getSelection();
      const savedRanges = sel
        ? Array.from({ length: sel.rangeCount }, (_, i) => sel.getRangeAt(i).cloneRange())
        : [];

      const fullText = textNode.textContent ?? "";
      const next: CompBox[] = [];
      for (const c of components) {
        let start = Math.max(0, Math.min(c.startIndex, textLen));
        let end = Math.max(start, Math.min(c.endIndex, textLen));
        // Skip leading and trailing whitespace (especially \n) so a
        // component whose range happens to include the newline separator
        // before / after it doesn't blow up the bbox across two lines.
        // Range.getBoundingClientRect() unions every line rect — even an
        // empty line break contributes a near-zero rect that pulls the
        // bbox top up to the previous line.
        while (start < end && /\s/.test(fullText[start] ?? "")) start++;
        while (end > start && /\s/.test(fullText[end - 1] ?? "")) end--;
        if (end <= start) continue;
        const range = document.createRange();
        try {
          range.setStart(textNode, start);
          range.setEnd(textNode, end);
        } catch {
          continue;
        }
        // Pick the LARGEST client rect (skips tiny leading-edge fragments
        // that some browsers emit for ranges starting at a line boundary)
        // and fall back to getBoundingClientRect when there are no rects.
        const rects = Array.from(range.getClientRects());
        const r = rects.length > 0 ? largestRect(rects) : range.getBoundingClientRect();
        next.push({
          id: c.id,
          color: c.color,
          top: r.top - overlayRect.top,
          left: r.left - overlayRect.left,
          width: r.width,
          height: r.height,
        });
      }

      if (sel) {
        sel.removeAllRanges();
        savedRanges.forEach((r) => sel.addRange(r));
      }

      setBoxes(next);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(editor);
    window.addEventListener("resize", compute);
    if (document.fonts) {
      document.fonts.ready.then(compute).catch(() => undefined);
    }
    return () => {
      ro.disconnect();
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

function findTextNode(host: HTMLElement): Text | null {
  for (let n = host.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === Node.TEXT_NODE) return n as Text;
  }
  return null;
}

/**
 * Pick the rect with the largest area — skips tiny line-edge fragments
 * (those near-zero rects browsers emit when a range starts or ends at a
 * line break) that would otherwise inflate the bbox across two lines.
 */
function largestRect(rects: DOMRect[]): DOMRect {
  let best = rects[0];
  for (const r of rects) {
    if (r.width * r.height > best.width * best.height) best = r;
  }
  return best;
}
