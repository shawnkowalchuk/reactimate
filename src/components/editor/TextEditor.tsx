import { useEffect, useLayoutEffect, useRef } from "react";
import { useProjectStore } from "../../store/projectStore";
import { diffStrings } from "../../utils/textDiff";
import { ComponentOverlay } from "./ComponentOverlay";
import { SelectionPopover } from "./SelectionPopover";

/**
 * Contenteditable text editor for the layer's hero text.
 *
 * Strategy:
 *  - The contenteditable contains a SINGLE text node — no line breaks,
 *    no inline styling. That makes Selection.start/endOffset directly
 *    usable as character offsets in `layer.text`.
 *  - Component highlights are rendered on a sibling overlay layer
 *    (absolutely positioned) so they don't fight the browser's
 *    cursor/selection.
 *  - React only writes to the DOM when `layer.text` changes from an
 *    EXTERNAL source (undo, file load, reset). User keystrokes update
 *    the store via `diffStrings → adjustRanges` and React leaves the
 *    DOM alone (preserving the cursor).
 */
export function TextEditor() {
  const text = useProjectStore((s) => s.project.layer.text);
  const components = useProjectStore((s) => s.project.layer.components);
  const defaultTextStyle = useProjectStore(
    (s) => s.project.defaultTextStyle,
  );
  const updateLayerText = useProjectStore((s) => s.updateLayerText);

  const editorRef = useRef<HTMLDivElement>(null);

  // Sync layer.text → DOM only when the external value diverged.
  // This handles undo, .json load, and reset-to-sample without
  // disturbing the cursor during normal typing.
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.textContent === text) return;
    const wasFocused = document.activeElement === el;
    el.textContent = text;
    if (wasFocused) placeCaretAtEnd(el);
  }, [text]);

  // Block line breaks (Enter / paste with newlines). We render the
  // hero text as a single line; multi-line is a future phase.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      const type = e.inputType;
      if (type === "insertParagraph" || type === "insertLineBreak") {
        e.preventDefault();
        return;
      }
      if (type === "insertFromPaste" && e.dataTransfer) {
        const pasted = e.dataTransfer.getData("text/plain");
        if (pasted.includes("\n")) {
          e.preventDefault();
          document.execCommand("insertText", false, pasted.replace(/\r?\n/g, " "));
        }
      }
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  const onInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const newText = el.textContent ?? "";
    if (newText === text) return;
    const edit = diffStrings(text, newText);
    if (!edit) return;
    updateLayerText(newText, edit.editStart, edit.editEnd, edit.newLength);
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-500">
        <span>Editor</span>
        <span className="text-neutral-700">·</span>
        <span className="text-neutral-600 normal-case tracking-normal">
          Type freely. Select text to componentize it.
        </span>
      </div>

      <div className="relative flex-1 overflow-auto rounded border border-neutral-800 bg-neutral-925 p-4">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          onInput={onInput}
          className="relative z-10 whitespace-pre-wrap break-words outline-none caret-sky-400"
          style={{
            fontFamily: defaultTextStyle.fontFamily,
            fontSize: 28,
            lineHeight: 1.4,
            fontWeight: defaultTextStyle.fontWeight,
            color: "#fafafa",
          }}
        >
          {text}
        </div>
        <ComponentOverlay editorRef={editorRef} components={components} text={text} />
        <SelectionPopover editorRef={editorRef} />
      </div>

      <div className="text-[11px] text-neutral-600">
        Components: {components.length === 0 ? "none yet" : null}
        {components.map((c, i) => (
          <span key={c.id} className="ml-1.5 inline-flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: c.color }}
            />
            <span className="text-neutral-300">
              "{text.slice(c.startIndex, c.endIndex)}"
            </span>
            {i < components.length - 1 ? <span className="text-neutral-700">·</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
