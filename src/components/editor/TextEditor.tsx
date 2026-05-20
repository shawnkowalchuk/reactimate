import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { useSelectionStore } from "../../store/selectionStore";
import { useCanvasScaleStore } from "../../store/canvasScaleStore";
import { diffStrings } from "../../utils/textDiff";
import { ComponentOverlay } from "./ComponentOverlay";
import { EditorActions } from "./EditorActions";
import { charOffsetToPoint, renderEditorDom } from "./editorDom";

/**
 * Contenteditable text editor for the layer's hero text.
 *
 * Important: this component does NOT render `layer.text` as JSX
 * children. React reconciliation would fight the browser's text
 * input and collapse the caret on every keystroke. Instead the DOM
 * is rebuilt imperatively by a useLayoutEffect that runs whenever
 * the model (`text` or `components`) changes.
 *
 * The DOM is a controlled render of the model: each componentized
 * run becomes a styled <span> carrying that component's font metrics
 * (see `renderEditorDom`), so the editor wraps text at exactly the
 * same points the preview does. On every `input` we read the flat
 * `textContent` (character offsets stay stable regardless of the span
 * structure), diff it into the store, then the layout effect rebuilds
 * the canonical DOM and restores the caret by character offset.
 *  - Enter / paragraph-break input types are intercepted and
 *    replaced with a literal `\n` via `insertText`.
 *  - Multi-line paste is normalized via the `paste` event.
 *  - IME composition is left to the browser (input events with
 *    `isComposing` are skipped); the commit event re-syncs.
 */
export function TextEditor() {
  const text = useProjectStore((s) => s.project.layer.text);
  const components = useProjectStore((s) => s.project.layer.components);
  const defaultTextStyle = useProjectStore(
    (s) => s.project.defaultTextStyle,
  );
  const alignment = useProjectStore((s) => s.project.layer.alignment);
  const lineHeight = useProjectStore((s) => s.project.layer.lineHeight);
  const updateLayerText = useProjectStore((s) => s.updateLayerText);
  const selectComponent = useSelectionStore((s) => s.selectComponent);

  const editorRef = useRef<HTMLDivElement>(null);
  // Char offset to restore the caret to after the next model-driven
  // rebuild. Set in `onInput` (captured post-keystroke); consumed by the
  // render effect below. Null for external changes (undo / file load).
  const pendingCaretRef = useRef<number | null>(null);

  // Controlled render: rebuild the contenteditable from the model
  // whenever `text` or `components` change — including per-component
  // style edits (font size, family, weight, letter-spacing), so the
  // editor stays pixel-faithful to the preview. Then restore the caret.
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const focused = document.activeElement === el;
    let caret = pendingCaretRef.current;
    pendingCaretRef.current = null;
    if (caret == null && focused) {
      // No keystroke pending — preserve wherever the live caret is.
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        caret = caretCharOffset(el);
      }
    }
    renderEditorDom(el, text, components);
    if (focused && caret != null) placeCaretAt(el, caret);
  }, [text, components]);

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

  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    // Mid-IME-composition input events: let the browser own the DOM;
    // the commit event (isComposing false) re-syncs everything.
    if ((e.nativeEvent as InputEvent).isComposing) return;
    const el = editorRef.current;
    if (!el) return;

    const newText = el.textContent ?? "";
    if (newText === text) {
      // No text change, but the browser may have left a non-canonical
      // span structure (merged / split spans) — rebuild it canonically
      // and keep the caret where it is.
      const caret = caretCharOffset(el);
      renderEditorDom(el, text, components);
      placeCaretAt(el, caret);
      return;
    }
    const edit = diffStrings(text, newText);
    if (!edit) return;
    // Capture the post-keystroke caret; the render effect restores it
    // once the store update round-trips back through the model.
    pendingCaretRef.current = caretCharOffset(el);
    updateLayerText(newText, edit.editStart, edit.editEnd, edit.newLength);
  };

  const canvasBg = useProjectStore((s) => s.project.canvas.background);
  const canvasW = useProjectStore((s) => s.project.canvas.width);
  const canvasH = useProjectStore((s) => s.project.canvas.height);

  // Scale-to-fit the canvas frame inside the available pane. Publishes
  // the local fit to the shared scale store; both editor and preview
  // render at the MIN so they always look the same size on screen.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [localFit, setLocalFit] = useState(1);
  const registerFit = useCanvasScaleStore((s) => s.registerFit);
  const unregisterFit = useCanvasScaleStore((s) => s.unregisterFit);
  const zoomLevel = useCanvasScaleStore((s) => s.zoomLevels["editor"] ?? 1);
  const setZoom = useCanvasScaleStore((s) => s.setZoom);
  const scale = localFit * zoomLevel;
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const compute = () => {
      const padding = 24;
      const sx = (wrap.clientWidth - padding * 2) / canvasW;
      const sy = (wrap.clientHeight - padding * 2) / canvasH;
      const fit = Math.max(0.05, Math.min(sx, sy));
      setLocalFit(fit);
      registerFit("editor", fit);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [canvasW, canvasH, registerFit]);
  useEffect(() => () => unregisterFit("editor"), [unregisterFit]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-500">
        <span>Editor</span>
        {/* Zoom controls */}
        <button type="button" className="rounded p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-800" onClick={() => setZoom("editor", Math.round((zoomLevel - 0.25) * 4) / 4)} title="Zoom out"><Minus size={12} /></button>
        <button type="button" className="rounded px-1 tabular-nums hover:bg-neutral-200 dark:hover:bg-neutral-800" onClick={() => setZoom("editor", 1)} title="Reset zoom">{Math.round(zoomLevel * 100)}%</button>
        <button type="button" className="rounded p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-800" onClick={() => setZoom("editor", Math.round((zoomLevel + 0.25) * 4) / 4)} title="Zoom in"><Plus size={12} /></button>
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
            // Lock layout to design size so the transform-scale below
            // gives a predictable visual ratio (matches PreviewCanvas).
            flexShrink: 0,
            flexGrow: 0,
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
              className="relative z-10 whitespace-pre-wrap outline-none caret-sky-400"
              style={{
                // width: 100% forces the contenteditable to span the full
                // padded canvas area instead of shrinking to its content's
                // min-width (which is what happens by default for a flex
                // item under justify-content: center). RenderedText already
                // uses width: 100% so this lines the two wrap points up.
                // fontFamily / fontSize / fontWeight / color / lineHeight /
                // textAlign mirror RenderedText's root so plain text and
                // wrap points match the preview; componentized runs get
                // their own per-component styles via renderEditorDom.
                width: "100%",
                fontFamily: defaultTextStyle.fontFamily,
                fontSize: defaultTextStyle.fontSize,
                lineHeight: lineHeight,
                fontWeight: defaultTextStyle.fontWeight,
                color: defaultTextStyle.color,
                textAlign: alignment,
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
  // Walk the styled-span tree to resolve the character offset to a
  // concrete (node, offset) point — the editor is no longer a single
  // flat text node.
  const point = charOffsetToPoint(el, offset);
  const range = document.createRange();
  range.setStart(point.node, point.offset);
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
