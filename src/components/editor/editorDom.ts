import type { Component } from "../../types/project";

export interface EditorRun {
  start: number;
  end: number;
  /** The component whose style this run renders with, or null for plain text. */
  component: Component | null;
}

/**
 * Split `text` into ordered, non-overlapping runs. Each character is
 * owned by the first component (earliest startIndex) that covers it;
 * uncovered characters are plain. Consecutive characters with the same
 * owner form one run.
 *
 * This mirrors the preview's first-component-wins inline flow so the
 * editor renders each componentized stretch with that component's font
 * metrics — and therefore wraps text at exactly the same points the
 * preview does.
 */
export function computeRuns(
  text: string,
  components: Component[],
): EditorRun[] {
  const n = text.length;
  if (n === 0) return [{ start: 0, end: 0, component: null }];

  const owner: (Component | null)[] = new Array(n).fill(null);
  const sorted = [...components]
    .filter((c) => c.endIndex > c.startIndex)
    .sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex);
  for (const c of sorted) {
    const start = Math.max(0, c.startIndex);
    const end = Math.min(n, c.endIndex);
    for (let i = start; i < end; i++) {
      if (owner[i] === null) owner[i] = c;
    }
  }

  const runs: EditorRun[] = [];
  let i = 0;
  while (i < n) {
    const c = owner[i];
    let j = i + 1;
    while (j < n && owner[j] === c) j++;
    runs.push({ start: i, end: j, component: c });
    i = j;
  }
  return runs;
}

/**
 * Imperatively (re)render the editor's contenteditable so every
 * componentized run gets a styled <span> carrying that component's
 * font family / weight / size / letter-spacing / color. Plain runs are
 * bare text nodes that inherit the editor's default-text style.
 *
 * Spans are `inline-block` to match the preview's component spans, so a
 * component whose text wraps onto two lines wraps the same way here.
 */
export function renderEditorDom(
  host: HTMLElement,
  text: string,
  components: Component[],
): void {
  const runs = computeRuns(text, components);
  const children: Node[] = [];
  for (const run of runs) {
    const slice = text.slice(run.start, run.end);
    const c = run.component;
    if (!c) {
      children.push(document.createTextNode(slice));
      continue;
    }
    const span = document.createElement("span");
    span.dataset.compId = c.id;
    const s = c.style;
    span.style.display = "inline-block";
    span.style.fontFamily = s.fontFamily;
    span.style.fontWeight = String(s.fontWeight);
    span.style.fontSize = `${s.fontSize}px`;
    span.style.letterSpacing = `${s.letterSpacing}px`;
    span.style.color = s.color;
    span.textContent = slice;
    children.push(span);
  }
  host.replaceChildren(...children);
}

/**
 * Map a character offset (into the editor's flat text) to a concrete
 * DOM (node, offset) point, walking the styled-span tree in document
 * order. Offsets are clamped into range, so the result is always a
 * valid Range boundary.
 */
export function charOffsetToPoint(
  host: HTMLElement,
  charOffset: number,
): { node: Node; offset: number } {
  const total = (host.textContent ?? "").length;
  const target = Math.max(0, Math.min(charOffset, total));
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let last: Text | null = null;
  let node = walker.nextNode() as Text | null;
  while (node) {
    last = node;
    const len = node.length;
    if (target <= acc + len) {
      return { node, offset: target - acc };
    }
    acc += len;
    node = walker.nextNode() as Text | null;
  }
  if (last) return { node: last, offset: last.length };
  return { node: host, offset: 0 };
}
