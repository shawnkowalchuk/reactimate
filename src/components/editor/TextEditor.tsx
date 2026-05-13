import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useSelectionStore } from "../../store/selectionStore";
import { diffStrings } from "../../utils/textDiff";
import { ComponentOverlay } from "./ComponentOverlay";
import { EditorActions } from "./EditorActions";

/**
 * Contenteditable text editor for the layer's hero text.
 *
 * Important: this component does NOT render `layer.text` as JSX
 * children. React reconciliation would fight the browser's text
 * input and collapse the caret to position 0 on every keystroke.
 * Instead the DOM text node is managed by a useLayoutEffect that
 * only writes when the store value diverged from the DOM (undo,
 * file load, reset-to-sample, etc.).
 *
 * The editor maintains a SINGLE text node so that
 * `Selection.startContainer === editor.firstChild` and
 * `Range.startOffset` is directly the character offset in
 * `layer.text`. To enforce this:
 *  - Enter / paragraph-break input types are intercepted and
 *    replaced with a literal `\n` via `insertText`
 *  - Multi-line paste is normalized via the `paste` event
 *  - On every `input`, if the DOM ended up with extra nodes
 *    (browser put a <br> or <div>), we re-flatten textContent
 *    back into a single text node and restore the caret.
 */
export function TextEditor() {
  const text = useProjectStore((s) => s.project.layer.text);
  const components = useProjectStore((s) => s.project.layer.components);
  const defaultTextStyle = useProjectStore(
    (s) => s.project.defaultTextStyle,
  );
  const updateLayerText = useProjectStore((s) => s.updateLayerText);
  const selectComponent = useSelectionStore((s) => s.selectComponent);

  const editorRef = useRef<HTMLDivElement>(null);

  // External text changes (undo, file load, reset) → push into the DOM.
  // User-keystroke updates round-trip through the store, but at the time
  // this effect re-runs the DOM already matches the store, so we skip.
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.textContent === text) return;
    const wasFocused = document.activeElement === el;
    el.textContent = text;
    if (wasFocused) placeCaretAtEnd(el);
  }, [text]);

  // Intercept Enter / paragraph: insert a literal "\n" instead of
  // letting the browser insert a <br> or <div>. Same for multi-line
  // paste. `execCommand('insertText', '\n')` is unreliable across
  // browsers (Chrome silently strips the newline), so we do it by
  // hand and fire `input` to keep the rest of the pipeline (diff →
  // store → adjustRanges) on the same path as any other edit.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      const type = e.inputType;
      if (type === "insertParagraph" || type === "insertLineBreak") {
        e.preventDefault();
        insertTextAtCaret(el, "\n");
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const pasted = e.clipboardData?.getData("text/plain") ?? "";
      if (!pasted) return;
      e.preventDefault();
      insertTextAtCaret(el, pasted);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    el.addEventListener("beforeinput", onBeforeInput);
    el.addEventListener("paste", onPaste);
    return () => {
      el.removeEventListener("beforeinput", onBeforeInput);
      el.removeEventListener("paste", onPaste);
    };
  }, []);

  const onInput = () => {
    const el = editorRef.current;
    if (!el) return;

    // Reflatten — if the browser still inserted a <br> or <div>
    // (some implementations do this even with our interceptor), flatten
    // back to a single text node so Selection offsets stay character-true.
    let dirty = false;
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== Node.TEXT_NODE) {
        dirty = true;
        break;
      }
    }
    if (el.childNodes.length > 1) dirty = true;

    let newText = el.textContent ?? "";
    if (dirty) {
      const caret = caretCharOffset(el);
      el.textContent = newText;
      newText = el.textContent ?? newText;
      placeCaretAt(el, caret);
    }

    if (newText === text) return;
    const edit = diffStrings(text, newText);
    if (!edit) return;
    updateLayerText(newText, edit.editStart, edit.editEnd, edit.newLength);
  };

  const canvasBg = useProjectStore((s) => s.project.canvas.background);
  const canvasW = useProjectStore((s) => s.project.canvas.width);
  const canvasH = useProjectStore((s) => s.project.canvas.height);

  // Scale-to-fit the canvas frame inside the available pane (mirrors
  // PreviewCanvas). Recomputes on pane or canvas resize.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const compute = () => {
      const padding = 24;
      const sx = (wrap.clientWidth - padding * 2) / canvasW;
      const sy = (wrap.clientHeight - padding * 2) / canvasH;
      setScale(Math.max(0.05, Math.min(sx, sy)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [canvasW, canvasH]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-500">
        <span>Editor</span>
        <span className="text-neutral-400 dark:text-neutral-700">·</span>
        <span className="text-neutral-500 normal-case tracking-normal">
          Type freely. Select text to{" "}
          <em className="not-italic text-neutral-700 dark:text-neutral-400">componentize</em>,{" "}
          <em className="not-italic text-neutral-700 dark:text-neutral-400">split</em>, or{" "}
          <em className="not-italic text-neutral-700 dark:text-neutral-400">merge</em>.
        </span>
        <div className="ml-auto">
          <EditorActions editorRef={editorRef} />
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900"
      >
        {/* Scaled canvas frame: same design dimensions as PreviewCanvas,
            transformed to fit. The inner contenteditable lives at the
            canvas's design size and is centered within it. */}
        <div
          className="relative"
          style={{
            width: canvasW,
            height: canvasH,
            background: canvasBg,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ padding: 64 }}
          >
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              onInput={onInput}
              className="relative z-10 max-w-full whitespace-pre-wrap break-words text-center outline-none caret-sky-400"
              style={{
                fontFamily: defaultTextStyle.fontFamily,
                fontSize: defaultTextStyle.fontSize,
                lineHeight: 1.1,
                fontWeight: defaultTextStyle.fontWeight,
                color: defaultTextStyle.color,
              }}
            />
          </div>
        </div>
        {/* Overlay sits OUTSIDE the scaled frame so its rect math runs in
            viewport pixels (otherwise the boxes + dots get visually shrunk
            by the canvas scale). It still measures the editor's text rects
            in viewport coords, which works through the transform. */}
        <ComponentOverlay editorRef={editorRef} components={components} text={text} />
      </div>

      <div className="text-[11px] text-neutral-500">
        Components: {components.length === 0 ? "none yet — select some text and click Componentize" : null}
        {components.map((c, i) => (
          <span key={c.id} className="ml-1.5 inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => selectComponent(c.id)}
              title="Edit this component's style"
              className="inline-flex items-center gap-1 rounded px-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: c.color }}
              />
              <span className="text-neutral-700 dark:text-neutral-300">
                "{text.slice(c.startIndex, c.endIndex)}"
              </span>
            </button>
            {i < components.length - 1 ? <span className="text-neutral-300 dark:text-neutral-700">·</span> : null}
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

function placeCaretAt(el: HTMLElement, offset: number) {
  const node = el.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) {
    placeCaretAtEnd(el);
    return;
  }
  const range = document.createRange();
  const safe = Math.max(0, Math.min(offset, (node.textContent ?? "").length));
  range.setStart(node, safe);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function caretCharOffset(editor: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return (editor.textContent ?? "").length;
  const range = sel.getRangeAt(0).cloneRange();
  range.setStart(editor, 0);
  return range.toString().length;
}

/**
 * Insert plain text at the current caret (collapsing any selection),
 * then leave the caret immediately after the inserted text. Doesn't
 * dispatch the `input` event itself — caller is responsible.
 */
function insertTextAtCaret(editor: HTMLElement, text: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
    // No caret in the editor — append.
    editor.appendChild(document.createTextNode(text));
    placeCaretAtEnd(editor);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
