import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Project } from "../../types/project";
import type { RegisterElement } from "../../playback/useAnimationEngine";
import {
  selectSharedScale,
  useCanvasScaleStore,
} from "../../store/canvasScaleStore";
import { RenderedText } from "./RenderedText";
import { SpotlightOverlay } from "./SpotlightOverlay";

interface PreviewCanvasProps {
  project: Project;
  registerElement: RegisterElement;
}

/**
 * Frames the design canvas (e.g. 1200x675 for 16:9) and scales it
 * to fit the available pane. Inner content is rendered at the
 * canvas's design dimensions so distances and sizes stay correct
 * — only the outer transform scales the whole thing.
 */
export function PreviewCanvas({ project, registerElement }: PreviewCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [, setLocalFit] = useState(1);
  const registerFit = useCanvasScaleStore((s) => s.registerFit);
  const unregisterFit = useCanvasScaleStore((s) => s.unregisterFit);
  // Both panes publish their fit-scale; we render at the MIN so the
  // editor and preview canvases always look the same size on screen.
  const sharedScale = useCanvasScaleStore((s) => selectSharedScale(s, 1));

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

  const scale = sharedScale;

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
          // Lock the layout to the declared design size — without this
          // the flex parent shrinks the frame BEFORE the transform is
          // applied, so design-pixel positioning (mouse, spotlight,
          // sparkle, mask) ends up scaled twice and offset.
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
        {/* Spotlight backdrop sits BEHIND the text inside the canvas. */}
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
            frameRef={frameRef}
          />
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-neutral-500">
        {project.canvas.width}×{project.canvas.height} · {project.canvas.preset}
      </div>
    </div>
  );
}
