import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Project } from "../../types/project";
import type { RegisterElement, RegisterShape } from "../../playback/useAnimationEngine";
import { useCanvasScaleStore } from "../../store/canvasScaleStore";
import { RenderedText } from "./RenderedText";
import { SpotlightOverlay } from "./SpotlightOverlay";
import { EffectAreaOverlay } from "./EffectAreaOverlay";

interface PreviewCanvasProps {
  project: Project;
  registerElement: RegisterElement;
  registerShape: RegisterShape;
}

/**
 * Frames the design canvas (e.g. 1200x675 for 16:9) and scales it
 * to fit the available pane. Inner content is rendered at the
 * canvas's design dimensions so distances and sizes stay correct
 * — only the outer transform scales the whole thing.
 */
export function PreviewCanvas({ project, registerElement, registerShape }: PreviewCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [localFit, setLocalFit] = useState(1);
  const registerFit = useCanvasScaleStore((s) => s.registerFit);
  const unregisterFit = useCanvasScaleStore((s) => s.unregisterFit);
  // Per-pane zoom (default 100%). Each pane zooms independently.
  const zoomLevel = useCanvasScaleStore((s) => s.zoomLevels["preview"] ?? 1);
  const setZoom = useCanvasScaleStore((s) => s.setZoom);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const compute = () => {
      const { clientWidth, clientHeight } = wrap;
      const padding = 24;
      const sx = (clientWidth - padding * 2) / project.canvas.width;
      const sy = (clientHeight - padding * 2) / project.canvas.height;
      const fit = Math.max(0.05, Math.min(sx, sy));
      setLocalFit(fit);
      registerFit("preview", fit);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [project.canvas.width, project.canvas.height, registerFit]);

  useEffect(() => () => unregisterFit("preview"), [unregisterFit]);

  const scale = localFit * zoomLevel;
  const zoomPct = Math.round(zoomLevel * 100);

  const changeZoom = (delta: number) => setZoom("preview", Math.round((zoomLevel + delta) * 4) / 4);

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900"
    >
      <div
        ref={frameRef}
        style={{
          position: "relative",
          width: project.canvas.width,
          height: project.canvas.height,
          flexShrink: 0,
          flexGrow: 0,
          background: project.canvas.background,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          padding: 64,
          boxSizing: "border-box",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        <SpotlightOverlay
          frameRef={frameRef}
          canvasWidth={project.canvas.width}
          canvasHeight={project.canvas.height}
          scale={scale}
        />
        <div
          style={{
            position: "absolute",
            inset: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RenderedText
            project={project}
            registerElement={registerElement}
            registerShape={registerShape}
            frameRef={frameRef}
          />
        </div>
        {/* Always-visible (while editing) draggable rectangles for any
            particle / fireworks effect's spawn / target area. Sits ABOVE
            the rendered text so the bbox handles are clickable, but its
            wrapper has pointer-events: none so it never blocks the editor's
            other interactions. */}
        <EffectAreaOverlay project={project} scale={scale} />
      </div>
      <div className="pointer-events-none absolute bottom-2 right-3 flex items-center gap-1 text-[11px] text-neutral-500">
        <button
          type="button"
          className="pointer-events-auto rounded p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-800"
          onClick={() => changeZoom(-0.25)}
          title="Zoom out"
        >
          <Minus size={12} />
        </button>
        <button
          type="button"
          className="pointer-events-auto rounded px-1 tabular-nums hover:bg-neutral-200 dark:hover:bg-neutral-800"
          onClick={() => setZoom("preview", 1)}
          title="Reset zoom"
        >
          {zoomPct}%
        </button>
        <button
          type="button"
          className="pointer-events-auto rounded p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-800"
          onClick={() => changeZoom(0.25)}
          title="Zoom in"
        >
          <Plus size={12} />
        </button>
        <span className="ml-2">
          {project.canvas.width}×{project.canvas.height} · {project.canvas.preset}
        </span>
      </div>
    </div>
  );
}
