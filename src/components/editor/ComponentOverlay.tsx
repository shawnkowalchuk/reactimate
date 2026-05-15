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

      const next: CompBox[] = [];
      for (const c of components) {
        const start = Math.max(0, Math.min(c.startIndex, textLen));
        const end = Math.max(start, Math.min(c.endIndex, textLen));
        if (end <= start) continue;
        const range = document.createRange();
        try {
          range.setStart(textNode, start);
          range.setEnd(textNode, end);
        } catch {
          continue;
        }
        const bRect = range.getBoundingClientRect();
        // Use getClientRects first rect for tighter vertical bounds
        // (getBoundingClientRect can include extra line-height space).
        const lines = Array.from(range.getClientRects());
        const firstLine = lines.length > 0 ? lines[0] : bRect;
        next.push({
          id: c.id,
          color: c.color,
          top: firstLine.top - overlayRect.top,
          left: bRect.left - overlayRect.left,
          width: bRect.width,
          height: firstLine.height,
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
