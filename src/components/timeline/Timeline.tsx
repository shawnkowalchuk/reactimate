import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { usePlaybackStore } from "../../store/playbackStore";
import { useSelectionStore } from "../../store/selectionStore";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineRow } from "./TimelineRow";
import { Playhead } from "./Playhead";
import { AddEffectMenu } from "./AddEffectMenu";
import { ROW_HEIGHT, pxPerSecond as pxPerSec } from "./timelineMath";

const GUTTER_WIDTH = 200;

export function Timeline() {
  const project = useProjectStore((s) => s.project);
  const duplicateComponent = useProjectStore((s) => s.duplicateComponent);
  const removeComponent = useProjectStore((s) => s.removeComponent);
  const toggleComponentHidden = useProjectStore((s) => s.toggleComponentHidden);
  const moveComponentUp = useProjectStore((s) => s.moveComponentUp);
  const moveComponentDown = useProjectStore((s) => s.moveComponentDown);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const selectNone = useSelectionStore((s) => s.selectNone);
  const selectComponent = useSelectionStore((s) => s.selectComponent);
  const selectionTarget = useSelectionStore((s) => s.target);

  const containerRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(800);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth - GUTTER_WIDTH - 24;
      setTrackWidth(Math.max(200, w));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const px = pxPerSec(trackWidth, project.duration);
  const components = project.layer.components;

  // Slow trackpad/wheel scroll inside the timeline so a single swipe
  // doesn't fly past dozens of rows. Scales the native deltaY by 0.35.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY === 0) return;
    const target = e.currentTarget;
    if (target.scrollHeight <= target.clientHeight) return;
    e.preventDefault();
    target.scrollTop += e.deltaY * 0.35;
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col overflow-y-auto overscroll-contain"
      onWheel={onWheel}
      onClick={(e) => {
        if (e.target === e.currentTarget) selectNone();
      }}
    >
      <div className="flex items-center justify-between px-3 py-1 text-xs uppercase tracking-wider text-neutral-500">
        <span>Timeline</span>
        <span className="text-neutral-400 dark:text-neutral-600">
          Drag block to move · drag edges to resize · Shift to disable snap
        </span>
      </div>

      <div className="flex">
        <div
          className="shrink-0 border-r border-neutral-200 dark:border-neutral-800"
          style={{ width: GUTTER_WIDTH }}
        >
          <div className="h-6 border-b border-neutral-200 dark:border-neutral-800" />
          {components.map((c, idx) => {
            const isSelected =
              selectionTarget.kind === "component" &&
              selectionTarget.componentId === c.id;
            return (
              <div
                key={c.id}
                className={`flex items-center gap-1 border-b border-neutral-200 px-2 text-xs dark:border-neutral-800 ${
                  isSelected
                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                    : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900/60"
                }`}
                style={{ height: ROW_HEIGHT }}
              >
                <div className="flex flex-col -space-y-0.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveComponentUp(c.id); }}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-20 dark:hover:text-neutral-200"
                    title="Move up"
                  >
                    <ArrowUp size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveComponentDown(c.id); }}
                    disabled={idx === components.length - 1}
                    className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-20 dark:hover:text-neutral-200"
                    title="Move down"
                  >
                    <ArrowDown size={10} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleComponentHidden(c.id); }}
                  className={`rounded p-0.5 hover:text-neutral-700 dark:hover:text-neutral-200 ${
                    c.hidden ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-500"
                  }`}
                  title={c.hidden ? "Show component" : "Hide component"}
                >
                  {c.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => selectComponent(c.id)}
                  className="flex flex-1 items-center gap-2 truncate text-left"
                  title={`Edit "${project.layer.text.slice(c.startIndex, c.endIndex)}"`}
                >
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                      isSelected ? "ring-2 ring-sky-400/70" : ""
                    }`}
                    style={{ background: c.color, opacity: c.hidden ? 0.3 : 1 }}
                  />
                  <span className={c.hidden ? "truncate opacity-40" : "truncate"}>
                    {project.layer.text.slice(c.startIndex, c.endIndex) ||
                      "(empty)"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newId = duplicateComponent(c.id);
                    if (newId) selectComponent(newId);
                  }}
                  className="rounded p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                  title="Duplicate component"
                >
                  <Copy size={12} />
                </button>
                <AddEffectMenu component={c} projectDuration={project.duration} />
                <button
                  type="button"
                  onClick={() => removeComponent(c.id)}
                  className="rounded p-0.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Delete component"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          {components.length === 0 && (
            <div
              className="px-3 text-xs text-neutral-400 dark:text-neutral-600"
              style={{ height: ROW_HEIGHT, lineHeight: `${ROW_HEIGHT}px` }}
            >
              no components yet
            </div>
          )}
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div className="relative" style={{ width: trackWidth }}>
            <TimelineRuler
              duration={project.duration}
              pxPerSecond={px}
              onSeek={setCurrentTime}
            />
            {components.map((c) => (
              <TimelineRow
                key={c.id}
                component={c}
                pxPerSecond={px}
                duration={project.duration}
              />
            ))}
            <Playhead
              currentTime={currentTime}
              duration={project.duration}
              pxPerSecond={px}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
