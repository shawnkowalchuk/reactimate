import { Trash2 } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { useUIStore } from "../../store/uiStore";
import { EFFECT_DEFAULTS, EFFECT_LABELS } from "../../constants/effects";
import type {
  AnimatableProp,
  AnimatableTargets,
  EffectType,
} from "../../types/project";
import { Modal } from "./Modal";
import { EasingPicker } from "./EasingPicker";

const numberInput =
  "w-20 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const selectInput =
  "rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

// "custom" appears first as the blank/placeholder type — that's what new
// effects start with from the timeline "+" button.
const TYPE_OPTIONS: EffectType[] = [
  "custom",
  "fade",
  "slide",
  "scale",
  "rotate",
  "color-shift",
];

const PROP_LABELS: Record<AnimatableProp, string> = {
  opacity: "Opacity",
  x: "X",
  y: "Y",
  scale: "Scale",
  rotation: "Rotation",
  color: "Color",
  fontSize: "Font size",
};

const PROP_UNITS: Partial<Record<AnimatableProp, string>> = {
  x: "px",
  y: "px",
  rotation: "°",
  fontSize: "px",
};

export function EffectModal() {
  const project = useProjectStore((s) => s.project);
  const updateEffect = useProjectStore((s) => s.updateEffect);
  const removeEffect = useProjectStore((s) => s.removeEffect);
  const target = useUIStore((s) => s.effectModal);
  const closeEffectModal = useUIStore((s) => s.closeEffectModal);

  const component = target
    ? project.layer.components.find((c) => c.id === target.componentId) ?? null
    : null;
  const effect = component
    ? component.effects.find((e) => e.id === target!.effectId) ?? null
    : null;
  const open = Boolean(component && effect);

  if (!open || !component || !effect) return null;

  const text = project.layer.text.slice(component.startIndex, component.endIndex);
  const onStart = (v: number) =>
    updateEffect(component.id, effect.id, { startTime: Math.max(0, v) });
  const onDur = (v: number) =>
    updateEffect(component.id, effect.id, { duration: Math.max(0.05, v) });

  // Switching type resets both `from` and `targets` to that type's defaults.
  const onType = (v: string) => {
    const nextType = v as EffectType;
    const defaults = EFFECT_DEFAULTS[nextType];
    updateEffect(component.id, effect.id, {
      type: nextType,
      from: { ...defaults.from },
      targets: { ...defaults.targets },
    });
  };

  const onDelete = () => {
    removeEffect(component.id, effect.id);
    closeEffectModal();
  };

  // The set of animated props is the union of keys in `from` and `targets`.
  const animProps = Array.from(
    new Set([
      ...Object.keys(effect.targets ?? {}),
      ...Object.keys(effect.from ?? {}),
    ]),
  ) as AnimatableProp[];

  const patchFrom = (prop: AnimatableProp, value: unknown) => {
    const nextFrom: AnimatableTargets = { ...effect.from, [prop]: value };
    updateEffect(component.id, effect.id, { from: nextFrom });
  };
  const patchTo = (prop: AnimatableProp, value: unknown) => {
    const nextTo: AnimatableTargets = { ...effect.targets, [prop]: value };
    updateEffect(component.id, effect.id, { targets: nextTo });
  };

  return (
    <Modal open onClose={closeEffectModal} title="Edit effect">
      <div className="flex flex-col gap-4 text-sm text-neutral-700 dark:text-neutral-300">
        <div className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: component.color }}
          />
          <span className="text-neutral-500">on</span>
          <span className="font-mono text-neutral-900 dark:text-neutral-100">
            "{text}"
          </span>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Type</span>
          <select
            value={effect.type}
            onChange={(e) => onType(e.target.value)}
            className={selectInput}
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {EFFECT_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Start time</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step={0.05}
                min={0}
                value={+effect.startTime.toFixed(2)}
                onChange={(e) => onStart(parseFloat(e.target.value) || 0)}
                className={numberInput}
              />
              <span className="text-xs text-neutral-400">s</span>
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Duration</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step={0.05}
                min={0.05}
                value={+effect.duration.toFixed(2)}
                onChange={(e) => onDur(parseFloat(e.target.value) || 0.05)}
                className={numberInput}
              />
              <span className="text-xs text-neutral-400">s</span>
            </div>
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-neutral-500">Easing</span>
          <EasingPicker
            value={effect.easing}
            onChange={(e) => updateEffect(component.id, effect.id, { easing: e })}
          />
        </div>

        {animProps.length > 0 && (
          <div className="flex flex-col gap-2 rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              Animates
            </div>
            <div className="grid grid-cols-[max-content_1fr_1fr] items-center gap-x-3 gap-y-2 text-xs">
              <div />
              <div className="text-neutral-500">Start</div>
              <div className="text-neutral-500">End</div>
              {animProps.map((p) => (
                <PropRow
                  key={p}
                  prop={p}
                  fromValue={effect.from?.[p]}
                  toValue={effect.targets?.[p]}
                  onFromChange={(v) => patchFrom(p, v)}
                  onToChange={(v) => patchTo(p, v)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-900/30"
          >
            <Trash2 size={12} />
            Delete effect
          </button>
          <button
            type="button"
            onClick={closeEffectModal}
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface PropRowProps {
  prop: AnimatableProp;
  fromValue: unknown;
  toValue: unknown;
  onFromChange: (v: unknown) => void;
  onToChange: (v: unknown) => void;
}

function PropRow({
  prop,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
}: PropRowProps) {
  const unit = PROP_UNITS[prop];
  return (
    <>
      <span className="text-neutral-700 dark:text-neutral-300">
        {PROP_LABELS[prop]}
      </span>
      <PropInput
        prop={prop}
        value={fromValue}
        onChange={onFromChange}
        unit={unit}
      />
      <PropInput prop={prop} value={toValue} onChange={onToChange} unit={unit} />
    </>
  );
}

interface PropInputProps {
  prop: AnimatableProp;
  value: unknown;
  onChange: (v: unknown) => void;
  unit?: string;
}

function PropInput({ prop, value, onChange, unit }: PropInputProps) {
  if (prop === "color") {
    const v = typeof value === "string" ? value : "#ffffff";
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={toHex(v)}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
        />
        <input
          type="text"
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-xs text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>
    );
  }

  const v = typeof value === "number" ? value : 0;
  const step = prop === "opacity" || prop === "scale" ? 0.05 : 1;
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        step={step}
        value={Number.isFinite(v) ? +v.toFixed(prop === "rotation" ? 0 : 2) : 0}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="w-20 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />
      {unit ? (
        <span className="text-[11px] text-neutral-400">{unit}</span>
      ) : null}
    </div>
  );
}

function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color.trim())) return color.trim();
  if (typeof document === "undefined") return "#ffffff";
  const el = document.createElement("div");
  el.style.color = color;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return "#ffffff";
  const hex = (n: string) => parseInt(n, 10).toString(16).padStart(2, "0");
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}
