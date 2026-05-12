import { useEffect, useRef, useState, type RefObject } from "react";
import { Plus } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { rangeOverlapsAny } from "../../engine/ranges";
import { CreateComponentDialog } from "./CreateComponentDialog";

interface SelectionPopoverProps {
  editorRef: RefObject<HTMLDivElement | null>;
}

interface PendingSelection {
  start: number;
  end: number;
  top: number;
  left: number;
}

export function SelectionPopover({ editorRef }: SelectionPopoverProps) {
  const components = useProjectStore((s) => s.project.layer.components);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const componentsRef = useRef(components);
  componentsRef.current = components;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const onSelectionChange = () => {
      if (dialogOpen) return; // freeze the popover while the modal is up

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

      const textNode = findTextNode(editor);
      if (!textNode || range.startContainer !== textNode || range.endContainer !== textNode) {
        setPending(null);
        return;
      }

      const start = Math.min(range.startOffset, range.endOffset);
      const end = Math.max(range.startOffset, range.endOffset);
      if (end <= start) {
        setPending(null);
        return;
      }

      if (rangeOverlapsAny(componentsRef.current, start, end)) {
        setPending(null);
        return;
      }

      const editorRect = editor.getBoundingClientRect();
      const rangeRect = range.getBoundingClientRect();
      setPending({
        start,
        end,
        top: rangeRect.top - editorRect.top - 6,
        left: rangeRect.left - editorRect.left + rangeRect.width / 2,
      });
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [editorRef, dialogOpen]);

  if (!pending) {
    return dialogOpen ? (
      <CreateComponentDialog
        startIndex={-1}
        endIndex={-1}
        onClose={() => setDialogOpen(false)}
      />
    ) : null;
  }

  return (
    <>
      <button
        type="button"
        // Stop pointerdown so the contenteditable doesn't collapse the
        // selection before our onClick runs.
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => setDialogOpen(true)}
        className="absolute z-20 flex items-center gap-1 rounded-md bg-sky-500 px-2.5 py-1 text-xs font-medium text-white shadow-lg ring-1 ring-sky-300/40 hover:bg-sky-400"
        style={{
          top: pending.top,
          left: pending.left,
          transform: "translate(-50%, -100%)",
        }}
      >
        <Plus size={12} />
        Componentize
      </button>
      {dialogOpen && (
        <CreateComponentDialog
          startIndex={pending.start}
          endIndex={pending.end}
          onClose={() => {
            setDialogOpen(false);
            setPending(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}
    </>
  );
}

function findTextNode(host: HTMLElement): Text | null {
  for (let n = host.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === Node.TEXT_NODE) return n as Text;
  }
  return null;
}
