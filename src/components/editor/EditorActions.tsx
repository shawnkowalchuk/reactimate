import { type RefObject } from "react";
import { Combine, Plus, Scissors } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { useSelectionStore } from "../../store/selectionStore";
import {
  useTextSelectionMode,
  type SelectionMode,
} from "./useTextSelectionMode";

interface Props {
  editorRef: RefObject<HTMLDivElement | null>;
}

/**
 * Three action buttons (Componentize / Split / Merge) on the editor's
 * toolbar row. Each is enabled only when the current text selection
 * makes that action valid. Componentize creates the component using the
 * layer's default style — the user customizes it via the Component
 * inspector row that appears after selection.
 */
export function EditorActions({ editorRef }: Props) {
  const addComponent = useProjectStore((s) => s.addComponent);
  const splitOffRange = useProjectStore((s) => s.splitOffRange);
  const mergeComponents = useProjectStore((s) => s.mergeComponents);
  const selectComponent = useSelectionStore((s) => s.selectComponent);
  const mode = useTextSelectionMode(editorRef);

  const isComponentize = mode?.kind === "componentize";
  const isSplit = mode?.kind === "split";
  const isMerge = mode?.kind === "merge";

  const onComponentize = () => {
    if (!isComponentize) return;
    const m = mode as Extract<SelectionMode, { kind: "componentize" }>;
    const id = addComponent(m.start, m.end);
    if (id) selectComponent(id);
    window.getSelection()?.removeAllRanges();
  };

  const onSplit = () => {
    if (!isSplit) return;
    const m = mode as Extract<SelectionMode, { kind: "split" }>;
    const id = splitOffRange(m.component.id, m.start, m.end);
    if (id) selectComponent(id);
    window.getSelection()?.removeAllRanges();
  };

  const onMerge = () => {
    if (!isMerge) return;
    const m = mode as Extract<SelectionMode, { kind: "merge" }>;
    // Pass the selection range so the merged component absorbs any plain
    // text on either side of the covered component(s).
    const id = mergeComponents(
      m.components.map((c) => c.id),
      { start: m.start, end: m.end },
    );
    if (id) selectComponent(id);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="flex items-center gap-1">
      <ActionButton
        enabled={isComponentize}
        onClick={onComponentize}
        icon={<Plus size={11} />}
        label="Componentize"
        title={
          isComponentize
            ? "Create a new component from the current selection"
            : "Select plain text in the editor to enable"
        }
      />
      <ActionButton
        enabled={isSplit}
        onClick={onSplit}
        icon={<Scissors size={11} />}
        label="Split"
        title={
          isSplit
            ? "Split off the selected range into its own component"
            : "Select text fully inside one component to enable"
        }
      />
      <ActionButton
        enabled={isMerge}
        onClick={onMerge}
        icon={<Combine size={11} />}
        label="Merge"
        title={
          isMerge
            ? (mode as { components: unknown[] }).components.length === 1
              ? "Extend the component to cover the selected plain text"
              : `Merge ${(mode as { components: unknown[] }).components.length} components`
            : "Select 2+ whole components, or a component + adjacent plain text"
        }
      />
    </div>
  );
}

interface BtnProps {
  enabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title: string;
}

function ActionButton({ enabled, onClick, icon, label, title }: BtnProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={!enabled}
      title={title}
      className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] normal-case tracking-normal ${
        enabled
          ? "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-500"
          : "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
