import { useLayoutEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { usePlaybackStore } from "../../store/playbackStore";
import { useSelectionStore } from "../../store/selectionStore";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineRow } from "./TimelineRow";
import { Playhead } from "./Playhead";
import { AddEffectMenu } from "./AddEffectMenu";
import { ROW_HEIGHT, pxPerSecond as pxPerSec } from "./timelineMath";
import { EFFECT_LABELS } from "../../constants/effects";
import { FONTS } from "../../constants/fonts";
import type {
  Component,
  ComponentStyle,
  EasingType,
  Effect,
} from "../../types/project";

const GUTTER_WIDTH = 200;

export function Timeline() {
  const project = useProjectStore((s) => s.project);
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

  const selectedComponent: Component | null =
    selectionTarget.kind === "component"
      ? components.find((c) => c.id === selectionTarget.componentId) ?? null
      : null;

  const selectedEffect: { component: Component; effect: Effect } | null = (() => {
    if (selectionTarget.kind !== "effect") return null;
    const c = components.find((x) => x.id === selectionTarget.componentId);
    if (!c) return null;
    const e = c.effects.find((x) => x.id === selectionTarget.effectId);
    if (!e) return null;
    return { component: c, effect: e };
  })();

  return (
    <div
      ref={containerRef}
      className="flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) selectNone();
      }}
    >
      <div className="flex items-center justify-between px-3 py-1 text-xs uppercase tracking-wider text-neutral-500">
        <span>Timeline</span>
        <span className="text-neutral-600">
          Drag block to move · drag edges to resize · Shift to disable snap
        </span>
      </div>

      <div className="flex">
        <div
          className="shrink-0 border-r border-neutral-800"
          style={{ width: GUTTER_WIDTH }}
        >
          <div className="h-6 border-b border-neutral-800" />
          {components.map((c) => {
            const isSelected =
              selectionTarget.kind === "component" &&
              selectionTarget.componentId === c.id;
            return (
              <div
                key={c.id}
                className={`flex items-center gap-2 border-b border-neutral-800 px-3 text-xs ${
                  isSelected
                    ? "bg-neutral-900 text-neutral-100"
                    : "text-neutral-300 hover:bg-neutral-900/60"
                }`}
                style={{ height: ROW_HEIGHT }}
              >
                <button
                  type="button"
                  onClick={() => selectComponent(c.id)}
                  className={`flex flex-1 items-center gap-2 truncate text-left ${
                    isSelected ? "" : ""
                  }`}
                  title={`Edit "${project.layer.text.slice(c.startIndex, c.endIndex)}"`}
                >
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                      isSelected ? "ring-2 ring-sky-300/70" : ""
                    }`}
                    style={{ background: c.color }}
                  />
                  <span className="truncate">
                    {project.layer.text.slice(c.startIndex, c.endIndex) ||
                      "(empty)"}
                  </span>
                </button>
                <AddEffectMenu component={c} projectDuration={project.duration} />
              </div>
            );
          })}
          {components.length === 0 && (
            <div
              className="px-3 text-xs text-neutral-600"
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

      <div className="mt-2 min-h-[44px] border-t border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
        {selectedEffect ? (
          <EffectInspectorStrip
            text={project.layer.text.slice(
              selectedEffect.component.startIndex,
              selectedEffect.component.endIndex,
            )}
            color={selectedEffect.component.color}
            componentId={selectedEffect.component.id}
            effectId={selectedEffect.effect.id}
            effectType={selectedEffect.effect.type}
            startTime={selectedEffect.effect.startTime}
            duration={selectedEffect.effect.duration}
            easing={selectedEffect.effect.easing}
            targets={selectedEffect.effect.targets as Record<string, unknown>}
          />
        ) : selectedComponent ? (
          <ComponentInspectorStrip
            component={selectedComponent}
            text={project.layer.text.slice(
              selectedComponent.startIndex,
              selectedComponent.endIndex,
            )}
          />
        ) : (
          <span className="text-neutral-600">
            Click a component (gutter chip) or an effect block to inspect/edit it.
          </span>
        )}
      </div>
    </div>
  );
}

interface EffectInspectorProps {
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

function EffectInspectorStrip(props: EffectInspectorProps) {
  const updateEffect = useProjectStore((s) => s.updateEffect);
  const removeEffect = useProjectStore((s) => s.removeEffect);
  const selectNone = useSelectionStore((s) => s.selectNone);

  const onStartChange = (v: number) =>
    updateEffect(props.componentId, props.effectId, {
      startTime: Math.max(0, v),
    });
  const onDurChange = (v: number) =>
    updateEffect(props.componentId, props.effectId, {
      duration: Math.max(0.05, v),
    });
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
      <span className="font-medium text-neutral-200">
        {EFFECT_LABELS[props.effectType]}
      </span>
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
        className="ml-auto flex items-center gap-1.5 rounded border border-red-900/60 px-2 py-0.5 text-red-300 hover:bg-red-900/30"
      >
        <Trash2 size={12} />
        Delete
      </button>
    </div>
  );
}

interface ComponentInspectorProps {
  component: Component;
  text: string;
}

function ComponentInspectorStrip({ component, text }: ComponentInspectorProps) {
  const updateComponentStyle = useProjectStore((s) => s.updateComponentStyle);
  const removeComponent = useProjectStore((s) => s.removeComponent);
  const selectNone = useSelectionStore((s) => s.selectNone);

  const fontOption =
    FONTS.find((f) => f.family === component.style.fontFamily) ?? FONTS[0];
  const weights = fontOption.weights;
  const safeWeight = weights.includes(component.style.fontWeight)
    ? component.style.fontWeight
    : weights[0];

  const patch = (style: Partial<ComponentStyle>) =>
    updateComponentStyle(component.id, style);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: component.color }}
      />
      <span className="font-medium text-neutral-200">Component</span>
      <span className="text-neutral-500">on</span>
      <span className="font-mono text-neutral-300">"{text}"</span>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Font</span>
        <select
          value={component.style.fontFamily}
          onChange={(e) => patch({ fontFamily: e.target.value })}
          className="rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-neutral-100 focus:border-neutral-500 focus:outline-none"
        >
          {FONTS.map((f) => (
            <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Wt</span>
        <select
          value={safeWeight}
          onChange={(e) => patch({ fontWeight: parseInt(e.target.value, 10) })}
          className="rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-neutral-100 focus:border-neutral-500 focus:outline-none"
        >
          {weights.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Size</span>
        <input
          type="number"
          min={8}
          max={400}
          step={2}
          value={component.style.fontSize}
          onChange={(e) =>
            patch({
              fontSize: Math.max(
                8,
                Math.min(400, parseInt(e.target.value, 10) || 0),
              ),
            })
          }
          className="w-16 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-neutral-100 tabular-nums focus:border-neutral-500 focus:outline-none"
        />
        <span className="text-neutral-600">px</span>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Color</span>
        <input
          type="color"
          value={toHex(component.style.color)}
          onChange={(e) => patch({ color: e.target.value })}
          className="h-5 w-7 cursor-pointer rounded border border-neutral-700 bg-neutral-900"
        />
        <input
          type="text"
          value={component.style.color}
          onChange={(e) => patch({ color: e.target.value })}
          className="w-28 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 font-mono text-neutral-100 focus:border-neutral-500 focus:outline-none"
        />
      </label>

      <button
        type="button"
        onClick={() => {
          removeComponent(component.id);
          selectNone();
        }}
        className="ml-auto flex items-center gap-1.5 rounded border border-red-900/60 px-2 py-0.5 text-red-300 hover:bg-red-900/30"
        title="Remove this component (returns its text to the layer default style)"
      >
        <Trash2 size={12} />
        Remove component
      </button>
    </div>
  );
}

function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color.trim())) return color.trim();
  if (typeof document === "undefined") return "#fafafa";
  const el = document.createElement("div");
  el.style.color = color;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return "#fafafa";
  const hex = (n: string) => parseInt(n, 10).toString(16).padStart(2, "0");
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}
