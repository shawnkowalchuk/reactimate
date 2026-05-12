import { useEffect, useRef, useState, type RefObject } from "react";
import { Plus, Scissors, Combine } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { useSelectionStore } from "../../store/selectionStore";
import type { Component } from "../../types/project";
import { CreateComponentDialog } from "./CreateComponentDialog";

interface SelectionPopoverProps {
  editorRef: RefObject<HTMLDivElement | null>;
}

type Mode =
  | { kind: "componentize"; start: number; end: number }
  | { kind: "split"; component: Component; start: number; end: number }
  | { kind: "merge"; components: Component[]; start: number; end: number };

interface PendingPopover {
  top: number;
  left: number;
  mode: Mode;
}

export function SelectionPopover({ editorRef }: SelectionPopoverProps) {
  const components = useProjectStore((s) => s.project.layer.components);
  const splitOffRange = useProjectStore((s) => s.splitOffRange);
  const mergeComponents = useProjectStore((s) => s.mergeComponents);
  const selectComponent = useSelectionStore((s) => s.selectComponent);

  const [pending, setPending] = useState<PendingPopover | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const componentsRef = useRef(components);
  componentsRef.current = components;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const onSelectionChange = () => {
      if (dialogOpen) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPending(null);
        return;
      }

      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) {
        setPending(null);
        return;
      }

      const offsets = charRangeWithin(editor, range);
      if (!offsets) {
        setPending(null);
        return;
      }
      const { start, end } = offsets;
      if (end <= start) {
        setPending(null);
        return;
      }

      const mode = classify(componentsRef.current, start, end);
      if (!mode) {
        setPending(null);
        return;
      }

      const editorRect = editor.getBoundingClientRect();
      const rangeRect = range.getBoundingClientRect();
      setPending({
        top: rangeRect.top - editorRect.top - 6,
        left: rangeRect.left - editorRect.left + rangeRect.width / 2,
        mode,
      });
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [editorRef, dialogOpen]);

  const closeDialog = () => {
    setDialogOpen(false);
    setPending(null);
    window.getSelection()?.removeAllRanges();
  };

  if (dialogOpen && pending?.mode.kind === "componentize") {
    return (
      <CreateComponentDialog
        startIndex={pending.mode.start}
        endIndex={pending.mode.end}
        onClose={closeDialog}
      />
    );
  }

  if (!pending) return null;

  const onClickAction = () => {
    if (pending.mode.kind === "componentize") {
      setDialogOpen(true);
      return;
    }
    if (pending.mode.kind === "split") {
      const id = splitOffRange(
        pending.mode.component.id,
        pending.mode.start,
        pending.mode.end,
      );
      if (id) selectComponent(id);
      setPending(null);
      window.getSelection()?.removeAllRanges();
      return;
    }
    // merge
    const id = mergeComponents(pending.mode.components.map((c) => c.id));
    if (id) selectComponent(id);
    setPending(null);
    window.getSelection()?.removeAllRanges();
  };

  const { label, icon, hue } = labelFor(pending.mode);

  return (
    <button
      type="button"
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClickAction}
      className={`absolute z-20 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-white shadow-lg ring-1 ${hue}`}
      style={{
        top: pending.top,
        left: pending.left,
        transform: "translate(-50%, -100%)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function labelFor(mode: Mode): {
  label: string;
  icon: React.ReactNode;
  hue: string;
} {
  if (mode.kind === "componentize") {
    return {
      label: "Componentize",
      icon: <Plus size={12} />,
      hue: "bg-sky-500 ring-sky-300/40 hover:bg-sky-400",
    };
  }
  if (mode.kind === "split") {
    return {
      label: "Split off",
      icon: <Scissors size={12} />,
      hue: "bg-amber-500 ring-amber-300/40 hover:bg-amber-400",
    };
  }
  return {
    label: `Merge ${mode.components.length}`,
    icon: <Combine size={12} />,
    hue: "bg-emerald-500 ring-emerald-300/40 hover:bg-emerald-400",
  };
}

/**
 * Decide what action the current selection allows:
 *  - empty intersection with all components → componentize
 *  - fully inside exactly one component → split-off
 *  - fully covers 2+ components AND no partial overlap → merge
 *  - any partial overlap → hide (would mangle component edges)
 */
function classify(
  components: readonly Component[],
  start: number,
  end: number,
): Mode | null {
  const intersecting = components.filter(
    (c) => c.startIndex < end && c.endIndex > start,
  );

  if (intersecting.length === 0) {
    return { kind: "componentize", start, end };
  }

  if (intersecting.length === 1) {
    const c = intersecting[0];
    if (start >= c.startIndex && end <= c.endIndex) {
      return { kind: "split", component: c, start, end };
    }
    return null; // partial overlap with one component
  }

  // 2+ intersecting — accept only if selection fully contains every one.
  const allFullyCovered = intersecting.every(
    (c) => start <= c.startIndex && end >= c.endIndex,
  );
  if (!allFullyCovered) return null;

  return { kind: "merge", components: intersecting, start, end };
}

/**
 * Convert a DOM Range to character offsets within the editor's
 * textContent. Works across multiple text nodes (`<br>`, etc.) by
 * using Range.toString().length, which mirrors how textContent
 * counts characters.
 */
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
