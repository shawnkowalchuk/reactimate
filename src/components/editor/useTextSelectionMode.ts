import { useEffect, useRef, useState, type RefObject } from "react";
import { useProjectStore } from "../../store/projectStore";
import type { Component } from "../../types/project";

export type SelectionMode =
  | { kind: "componentize"; start: number; end: number }
  | { kind: "split"; component: Component; start: number; end: number }
  | { kind: "merge"; components: Component[]; start: number; end: number };

/**
 * Watches the document selection and reports the action that the
 * current text selection allows inside the given editor:
 *  - empty intersection with all components → componentize
 *  - fully inside exactly one component     → split-off
 *  - fully covers 1 component + extra plain text on either side → merge
 *    (absorbs the plain text into the component's range)
 *  - fully covers 2+ components             → merge
 *  - partial overlap with a component (edge straddled) → null
 *  - no selection / outside the editor      → null
 */
export function useTextSelectionMode(
  editorRef: RefObject<HTMLDivElement | null>,
): SelectionMode | null {
  const components = useProjectStore((s) => s.project.layer.components);
  const componentsRef = useRef(components);
  componentsRef.current = components;

  const [mode, setMode] = useState<SelectionMode | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const onChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setMode(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) {
        setMode(null);
        return;
      }
      const offsets = charRangeWithin(editor, range);
      if (!offsets || offsets.end <= offsets.start) {
        setMode(null);
        return;
      }
      setMode(classify(componentsRef.current, offsets.start, offsets.end));
    };

    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [editorRef]);

  return mode;
}

function classify(
  components: readonly Component[],
  start: number,
  end: number,
): SelectionMode | null {
  const intersecting = components.filter(
    (c) => c.startIndex < end && c.endIndex > start,
  );
  if (intersecting.length === 0) {
    return { kind: "componentize", start, end };
  }
  if (intersecting.length === 1) {
    const c = intersecting[0];
    // Selection sits entirely inside the component → split-off.
    if (start >= c.startIndex && end <= c.endIndex) {
      return { kind: "split", component: c, start, end };
    }
    // Selection fully contains the component AND extends into plain text
    // on at least one side → "merge" (extends the component's range).
    if (start <= c.startIndex && end >= c.endIndex) {
      return { kind: "merge", components: [c], start, end };
    }
    // Edge straddle (selection crosses one boundary but not the other)
    // would mangle the component — disallow.
    return null;
  }
  const allFullyCovered = intersecting.every(
    (c) => start <= c.startIndex && end >= c.endIndex,
  );
  if (!allFullyCovered) return null;
  return { kind: "merge", components: intersecting, start, end };
}

function charRangeWithin(
  editor: HTMLElement,
  range: Range,
): { start: number; end: number } | null {
  if (!editor.contains(range.startContainer)) return null;
  if (!editor.contains(range.endContainer)) return null;
  const startProbe = document.createRange();
  startProbe.setStart(editor, 0);
  startProbe.setEnd(range.startContainer, range.startOffset);
  const endProbe = document.createRange();
  endProbe.setStart(editor, 0);
  endProbe.setEnd(range.endContainer, range.endOffset);
  return {
    start: startProbe.toString().length,
    end: endProbe.toString().length,
  };
}
