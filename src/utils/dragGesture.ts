import { useCallback, useRef } from "react";

export interface DragGestureCallbacks {
  /** Called once when the pointer goes down. */
  onStart?: (e: React.PointerEvent) => void;
  /** Called for each pointermove. `dx`/`dy` are deltas from the initial down. */
  onMove?: (dx: number, dy: number, e: PointerEvent) => void;
  /** Called when the pointer is released or capture is lost. */
  onEnd?: (e: PointerEvent | null) => void;
  /** Skip the gesture entirely (e.g. if the user clicked a child button). */
  shouldStart?: (e: React.PointerEvent) => boolean;
}

/**
 * Small primitive for "press a node and drag the pointer". Uses pointer
 * capture so it keeps tracking even when the cursor leaves the element.
 * Returns an `onPointerDown` to spread onto the draggable node.
 */
export function useDragGesture(cb: DragGestureCallbacks) {
  const stateRef = useRef<{
    startX: number;
    startY: number;
    pointerId: number;
    target: HTMLElement;
    onMove: (e: PointerEvent) => void;
    onUp: (e: PointerEvent) => void;
  } | null>(null);

  const cbRef = useRef(cb);
  cbRef.current = cb;

  return useCallback((e: React.PointerEvent) => {
    if (cbRef.current.shouldStart && !cbRef.current.shouldStart(e)) return;
    if (e.button !== 0) return;
    e.preventDefault();

    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture isn't available for this pointer (e.g. synthetic
      // events in tests). The gesture still works through window listeners.
    }

    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: PointerEvent) => {
      cbRef.current.onMove?.(ev.clientX - startX, ev.clientY - startY, ev);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      cbRef.current.onEnd?.(ev);
      stateRef.current = null;
    };

    stateRef.current = { startX, startY, pointerId: e.pointerId, target, onMove, onUp };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    cbRef.current.onStart?.(e);
  }, []);
}
