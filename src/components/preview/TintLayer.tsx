import { useLayoutEffect, useRef, useState, type RefObject } from "react";

interface TintLayerProps {
  text: string;
  color: string;
  /** Spotlight beam center in canvas-design coordinates. */
  spotPos: { x: number; y: number };
  size: number;
  shape: "circle" | "square";
  featherPx: number;
  frameRef: RefObject<HTMLDivElement | null>;
}

/**
 * A pixel-exact copy of the wrapped text span, recolored to the
 * spotlight color and CSS-masked so only the portion within the
 * spotlight beam is visible. Sits absolutely on top of its parent
 * span. Outside the beam it's invisible -> the original text color
 * underneath shows through.
 *
 * Position math: we measure THIS element's parent (the relative
 * wrapper) against the canvas frame to get the wrapper's offset in
 * canvas-design coordinates. Mask coords are then `spotPos - offset`,
 * which is the spotlight position in span-local coords.
 */
export function TintLayer({
  text,
  color,
  spotPos,
  size,
  shape,
  featherPx,
  frameRef,
}: TintLayerProps) {
  const selfRef = useRef<HTMLSpanElement>(null);
  // Bumped on relayout to force a re-render so the offsetRef-based
  // mask CSS below uses the freshly-measured value.
  const [, setLayoutTick] = useState(0);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const self = selfRef.current;
    const frame = frameRef.current;
    if (!self || !frame) return;
    const wrap = self.parentElement;
    if (!wrap) return;
    const compute = () => {
      const w = wrap.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      const designWidth = parseFloat(frame.style.width || "0") || f.width;
      const scale = designWidth > 0 ? f.width / designWidth : 1;
      const safeScale = Math.max(0.0001, scale);
      offsetRef.current = {
        x: (w.left - f.left) / safeScale,
        y: (w.top - f.top) / safeScale,
      };
      setLayoutTick((t) => t + 1);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    ro.observe(frame);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [frameRef, text]);

  const offset = offsetRef.current;
  const lx = spotPos.x - offset.x;
  const ly = spotPos.y - offset.y;
  let maskCss: string;
  if (shape === "circle") {
    const innerStop = Math.max(0, size - Math.max(0, featherPx));
    maskCss = `radial-gradient(${size}px at ${lx}px ${ly}px, black ${innerStop}px, transparent ${size}px)`;
  } else {
    maskCss = `linear-gradient(black, black) ${lx - size}px ${ly - size}px / ${
      size * 2
    }px ${size * 2}px no-repeat`;
  }

  return (
    <span
      ref={selfRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        color,
        pointerEvents: "none",
        whiteSpace: "pre",
        maskImage: maskCss,
        WebkitMaskImage: maskCss,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    >
      {text}
    </span>
  );
}
