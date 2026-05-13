import { useLayoutEffect, useRef, useState } from "react";
import type { Project } from "../../types/project";
import type { RegisterElement } from "../../playback/useAnimationEngine";
import { RenderedText } from "./RenderedText";

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
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const compute = () => {
      const { clientWidth, clientHeight } = wrap;
      const padding = 24;
      const sx = (clientWidth - padding * 2) / project.canvas.width;
      const sy = (clientHeight - padding * 2) / project.canvas.height;
      setScale(Math.max(0.05, Math.min(sx, sy)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [project.canvas.width, project.canvas.height]);

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900"
    >
      <div
        style={{
          width: project.canvas.width,
          height: project.canvas.height,
          background: project.canvas.background,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 64,
          boxSizing: "border-box",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        <RenderedText project={project} registerElement={registerElement} />
      </div>
      <div className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-neutral-500">
        {project.canvas.width}×{project.canvas.height} · {project.canvas.preset}
      </div>
    </div>
  );
}
