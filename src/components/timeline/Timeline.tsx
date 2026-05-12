import { useLayoutEffect, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { usePlaybackStore } from "../../store/playbackStore";
import { useSelectionStore } from "../../store/selectionStore";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineRow } from "./TimelineRow";
import { Playhead } from "./Playhead";
import { ROW_HEIGHT, pxPerSecond as pxPerSec } from "./timelineMath";
import { EFFECT_LABELS } from "../../constants/effects";
import type { EasingType } from "../../types/project";

const GUTTER_WIDTH = 160;

export function Timeline() {
  const project = useProjectStore((s) => s.project);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const selectNone = useSelectionStore((s) => s.selectNone);
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

  // Selected effect details for the inspector strip
  const selectedDetails = (() => {
    if (selectionTarget.kind !== "effect") return null;
    const c = components.find((x) => x.id === selectionTarget.componentId);
    if (!c) return null;
    const e = c.effects.find((x) => x.id === selectionTarget.effectId);
    if (!e) return null;
    return { component: c, effect: e };
  })();

  return (
    <div ref={containerRef} className="flex flex-col" onClick={(e) => {
      // Click on empty timeline area deselects
      if (e.target === e.currentTarget) selectNone();
    }}>
      <div className="flex items-center justify-between px-3 py-1 text-xs uppercase tracking-wider text-neutral-500">
        <span>Timeline</span>
        <span className="text-neutral-600">
          Drag block to move · drag edges to resize · Shift to disable snap
        </span>
      </div>

      <div className="flex">
        {/* Left gutter — component labels */}
        <div
          className="shrink-0 border-r border-neutral-800"
          style={{ width: GUTTER_WIDTH }}
        >
          <div className="h-6 border-b border-neutral-800" />
          {components.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 border-b border-neutral-800 px-3 text-xs text-neutral-300"
              style={{ height: ROW_HEIGHT }}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: c.color }}
              />
              <span className="truncate">
                {project.layer.text.slice(c.startIndex, c.endIndex) || "(empty)"}
              </span>
            </div>
          ))}
          {components.length === 0 && (
            <div
              className="px-3 text-xs text-neutral-600"
              style={{ height: ROW_HEIGHT, lineHeight: `${ROW_HEIGHT}px` }}
            >
              no components yet
            </div>
          )}
        </div>

        {/* Right track — ruler, rows, playhead */}
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

      {/* Inspector strip */}
      <div className="mt-2 min-h-[44px] border-t border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
        {selectedDetails ? (
          <EffectInspectorStrip
            text={project.layer.text.slice(
              selectedDetails.component.startIndex,
              selectedDetails.component.endIndex,
            )}
            color={selectedDetails.component.color}
            componentId={selectedDetails.component.id}
            effectId={selectedDetails.effect.id}
            effectType={selectedDetails.effect.type}
            startTime={selectedDetails.effect.startTime}
            duration={selectedDetails.effect.duration}
            easing={selectedDetails.effect.easing}
            targets={selectedDetails.effect.targets as Record<string, unknown>}
          />
        ) : (
          <span className="text-neutral-600">
            Click an effect block to inspect/edit it.
          </span>
        )}
      </div>
    </div>
  );
}

interface InspectorProps {
  text: string;
  color: string;
  componentId: string;
  effectId: string;
  effectType: keyof typeof EFFECT_LABELS;
  startTime: number;
  duration: number;
  easing: EasingType;
  targets: Record<string, unknown>;
}

function EffectInspectorStrip(props: InspectorProps) {
  const updateEffect = useProjectStore((s) => s.updateEffect);
  const removeEffect = useProjectStore((s) => s.removeEffect);
  const selectNone = useSelectionStore((s) => s.selectNone);

  const onStartChange = (v: number) =>
    updateEffect(props.componentId, props.effectId, { startTime: Math.max(0, v) });
  const onDurChange = (v: number) =>
    updateEffect(props.componentId, props.effectId, { duration: Math.max(0.05, v) });
  const onEasingChange = (v: string) =>
    updateEffect(props.componentId, props.effectId, {
      easing: v as EasingType,
    });

  const onDelete = () => {
    removeEffect(props.componentId, props.effectId);
    selectNone();
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: props.color }}
      />
      <span className="font-medium text-neutral-200">{EFFECT_LABELS[props.effectType]}</span>
      <span className="text-neutral-500">on</span>
      <span className="font-mono text-neutral-300">"{props.text}"</span>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Start</span>
        <input
          type="number"
          step={0.05}
          min={0}
          value={+props.startTime.toFixed(2)}
          onChange={(e) => onStartChange(parseFloat(e.target.value) || 0)}
          className="w-16 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-neutral-100 tabular-nums focus:border-neutral-500 focus:outline-none"
        />
        <span className="text-neutral-600">s</span>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Dur</span>
        <input
          type="number"
          step={0.05}
          min={0.05}
          value={+props.duration.toFixed(2)}
          onChange={(e) => onDurChange(parseFloat(e.target.value) || 0.05)}
          className="w-16 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-neutral-100 tabular-nums focus:border-neutral-500 focus:outline-none"
        />
        <span className="text-neutral-600">s</span>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Easing</span>
        <select
          value={props.easing}
          onChange={(e) => onEasingChange(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-neutral-100 focus:border-neutral-500 focus:outline-none"
        >
          <option value="linear">linear</option>
          <option value="ease-in">ease-in</option>
          <option value="ease-out">ease-out</option>
          <option value="ease-in-out">ease-in-out</option>
          <option value="spring">spring</option>
          <option value="bounce">bounce</option>
        </select>
      </label>

      <span className="text-neutral-500">
        Animates: {Object.keys(props.targets).join(", ") || "(nothing)"}
      </span>

      <button
        type="button"
        onClick={onDelete}
        className="ml-auto rounded border border-red-900/60 px-2 py-0.5 text-red-300 hover:bg-red-900/30"
      >
        Delete
      </button>
    </div>
  );
}
