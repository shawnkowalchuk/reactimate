import { useEffect, useState } from "react";
import { Copy, Download, Trash2, Upload } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { useUIStore } from "../../store/uiStore";
import { usePresetStore, type PresetConfig } from "../../store/presetStore";
import { EFFECT_DEFAULTS, EFFECT_LABELS } from "../../constants/effects";
import type {
  AnimatableProp,
  AnimatableTargets,
  EffectType,
} from "../../types/project";
import { Modal } from "./Modal";
import { EasingPicker } from "./EasingPicker";
import { ParticleTypePicker, type ParticleType } from "./ParticleTypePicker";
import { ColorPicker } from "../ui/ColorPicker";
import { PRESET_COLOR_FNS, PARTICLE_SHAPES, particlePath, hash, pseudo } from "../preview/particleUtils";

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
  "rotate",
  "zoom",
  "color-shift",
  "spotlight",
  "particle",
  "typewriter",
  "blur",
  "fireworks-js",
];

const PROP_LABELS: Record<AnimatableProp, string> = {
  opacity: "Opacity",
  x: "X",
  y: "Y",
  scale: "Scale",
  rotation: "Rotation",
  color: "Color",
  fontSize: "Font size",
  blur: "Blur",
};

const PROP_UNITS: Partial<Record<AnimatableProp, string>> = {
  x: "px",
  y: "px",
  rotation: "°",
  fontSize: "px",
  blur: "px",
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

  // Switching type resets `from`/`targets` AND nulls out any stale
  // type-specific config blocks (spotlight/particle/typewriter) from the
  // previous type. The new type's own config block is then seeded.
  const onType = (v: string) => {
    const nextType = v as EffectType;
    const defaults = EFFECT_DEFAULTS[nextType];
    const patch: Partial<typeof effect> = {
      type: nextType,
      from: { ...defaults.from },
      targets: { ...defaults.targets },
      spotlight: undefined,
      particle: undefined,
      typewriter: undefined,
      fireworks: undefined,
      staggerLetters: false,
    };
    if (nextType === "spotlight") {
      patch.spotlight = effect.spotlight ?? {
        shape: "circle",
        size: 220,
        color: "#fbbf24",
        opacity: 0.55,
        motion: "mouse",
        showBackdrop: true,
      };
    }
    if (nextType === "particle") {
      patch.particle = effect.particle ?? {
        density: 24,
        size: 20,
        color: "#fbbf24",
        preset: "gold",
        shape: "star" as const,
        type: "standard",
        mode: "component",
        continueAfter: false,
      };
    }
    if (nextType === "typewriter") {
      patch.typewriter = effect.typewriter ?? { mode: "fade" };
      patch.staggerLetters = true;
    }
    if (nextType === "fireworks-js") {
      patch.fireworks = effect.fireworks ?? {
        density: 50,
        explosion: 5,
        gravity: 1.5,
        opacity: 0.5,
        flickering: 50,
        acceleration: 1.05,
        friction: 0.97,
        traceLength: 3,
        traceSpeed: 10,
        intensity: 30,
        lineStyle: "round",
        rocketsSpread: 80,
        mode: "component",
        spreadRadius: 100,
        delayMin: 10,
        delayMax: 60,
        brightnessMin: 50,
        brightnessMax: 80,
        decayMin: 0.015,
        decayMax: 0.03,
        hueMin: 0,
        hueMax: 360,
        rocketsPointMin: 30,
        rocketsPointMax: 70,
        lineWidthExpMin: 1,
        lineWidthExpMax: 3,
        lineWidthTraceMin: 1,
        lineWidthTraceMax: 2,
        continueAfter: false,
      };
    }
    updateEffect(component.id, effect.id, patch);
  };

  const patchParticle = (
    update: Partial<NonNullable<typeof effect.particle>>,
  ) => {
    const current = effect.particle ?? {
      density: 24,
      size: 20,
      color: "#fbbf24",
      preset: "gold" as const,
    };
    updateEffect(component.id, effect.id, {
      particle: { ...current, ...update },
    });
  };

  const patchTypewriter = (
    update: Partial<NonNullable<typeof effect.typewriter>>,
  ) => {
    const current = effect.typewriter ?? { mode: "fade" as const };
    updateEffect(component.id, effect.id, {
      typewriter: { ...current, ...update },
    });
  };

  const patchSpotlight = (
    update: Partial<NonNullable<typeof effect.spotlight>>,
  ) => {
    const current = effect.spotlight ?? {
      shape: "circle" as const,
      size: 220,
      color: "#fbbf24",
      opacity: 0.55,
      motion: "mouse" as const,
      showBackdrop: true,
    };
    updateEffect(component.id, effect.id, {
      spotlight: { ...current, ...update },
    });
  };

  const patchFireworks = (
    update: Partial<NonNullable<typeof effect.fireworks>>,
  ) => {
    const current = effect.fireworks ?? {
      density: 50,
      explosion: 5,
      gravity: 1.5,
      opacity: 0.5,
      flickering: 50,
      acceleration: 1.05,
      friction: 0.97,
      traceLength: 3,
      traceSpeed: 10,
      intensity: 30,
      lineStyle: "round",
      rocketsSpread: 80,
      mode: "component",
      spreadRadius: 100,
      delayMin: 10,
      delayMax: 60,
      brightnessMin: 50,
      brightnessMax: 80,
      decayMin: 0.015,
      decayMax: 0.03,
      hueMin: 0,
      hueMax: 360,
    };
    updateEffect(component.id, effect.id, { fireworks: { ...current, ...update } });
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

        <PresetBar
          effect={effect}
          onApply={(cfg) =>
            updateEffect(component.id, effect.id, { ...cfg })
          }
        />

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

        {effect.type !== "fireworks-js" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-neutral-500">Easing</span>
          <EasingPicker
            value={effect.easing}
            onChange={(e) => updateEffect(component.id, effect.id, { easing: e })}
          />
        </div>
        )}

        {effect.type === "slide" && (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={Boolean(effect.maskBox)}
              onChange={(e) =>
                updateEffect(component.id, effect.id, { maskBox: e.target.checked })
              }
              className="h-3.5 w-3.5 cursor-pointer"
            />
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              Mask box
            </span>
            <span className="text-neutral-500">
              clip text within its bounding box so it slides in from behind
            </span>
          </label>
        )}

        {effect.type !== "particle" && effect.type !== "fireworks-js" && (
          <div className="flex flex-col gap-1.5 rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={Boolean(effect.staggerLetters)}
                onChange={(e) =>
                  updateEffect(component.id, effect.id, {
                    staggerLetters: e.target.checked,
                  })
                }
                className="h-3.5 w-3.5 cursor-pointer"
              />
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                Stagger letters
              </span>
              <span className="text-neutral-500">
                animate each character with a delay
              </span>
            </label>
            {effect.staggerLetters && (
              <>
                <label className="flex items-center gap-2 pl-6 text-xs">
                  <span className="text-neutral-500">Delay between letters</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    value={+(effect.staggerDelay ?? 0.05).toFixed(2)}
                    onChange={(e) =>
                      updateEffect(component.id, effect.id, {
                        staggerDelay: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="w-20 rounded border border-neutral-300 bg-white px-2 py-0.5 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  />
                  <span className="text-neutral-400">s</span>
                </label>
                <label className="flex items-center gap-2 pl-6 text-xs">
                  <span className="text-neutral-500">Direction</span>
                  <div className="flex gap-1">
                    <ShapeBtn
                      active={(effect.staggerDirection ?? "forward") === "forward"}
                      onClick={() =>
                        updateEffect(component.id, effect.id, {
                          staggerDirection: "forward",
                        })
                      }
                      label="Front → back"
                    />
                    <ShapeBtn
                      active={effect.staggerDirection === "reverse"}
                      onClick={() =>
                        updateEffect(component.id, effect.id, {
                          staggerDirection: "reverse",
                        })
                      }
                      label="Back → front"
                    />
                  </div>
                </label>
              </>
            )}
          </div>
        )}

        {effect.type === "spotlight" && (
          <SpotlightPanel
            spotlight={
              effect.spotlight ?? {
                shape: "circle",
                size: 220,
                color: "#fbbf24",
                opacity: 0.55,
                motion: "mouse",
                showBackdrop: true,
              }
            }
            onChange={patchSpotlight}
          />
        )}

        {effect.type === "particle" && (
          <ParticlePanel
            particle={
              effect.particle ?? {
                density: 8,
                size: 14,
                color: "#fbbf24",
                preset: "gold",
              }
            }
            onChange={patchParticle}
          />
        )}

        {effect.type === "typewriter" && (
          <TypewriterPanel
            typewriter={effect.typewriter ?? { mode: "fade" }}
            onChange={patchTypewriter}
          />
        )}

        {effect.type === "fireworks-js" && (
          <FireworksPanel
            fireworks={
              effect.fireworks ?? {
                density: 50,
                explosion: 5,
                gravity: 1.5,
                opacity: 0.5,
                flickering: 50,
                acceleration: 1.05,
                friction: 0.97,
                traceLength: 3,
                traceSpeed: 10,
                intensity: 30,
                lineStyle: "round",
                rocketsSpread: 80,
                mode: "component",
                spreadRadius: 100,
                delayMin: 50,
                delayMax: 200,
                brightnessMin: 50,
                brightnessMax: 80,
                decayMin: 0.015,
                decayMax: 0.03,
                hueMin: 0,
                hueMax: 360,
                continueAfter: false,
              }
            }
            onChange={patchFireworks}
          />
        )}

        {effect.type !== "spotlight" &&
          effect.type !== "particle" &&
          effect.type !== "typewriter" &&
          effect.type !== "fireworks-js" &&
          animProps.length > 0 && (
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

interface SpotlightConfig {
  shape: "circle" | "square";
  size: number;
  color: string;
  opacity: number;
  motion: "mouse" | "sweep-left" | "sweep-right";
  maskText?: boolean;
  maskMode?: "tint" | "reveal";
  featherPx?: number;
  showBackdrop?: boolean;
  sweepY?: number;
}

interface SpotlightPanelProps {
  spotlight: SpotlightConfig;
  onChange: (update: Partial<SpotlightConfig>) => void;
}

function SpotlightPanel({ spotlight, onChange }: SpotlightPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs uppercase tracking-wider text-neutral-500">
        Spotlight
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Shape</span>
          <div className="flex gap-1">
            <ShapeBtn
              active={spotlight.shape === "circle"}
              onClick={() => onChange({ shape: "circle" })}
              label="Circle"
            />
            <ShapeBtn
              active={spotlight.shape === "square"}
              onClick={() => onChange({ shape: "square" })}
              label="Square"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Motion</span>
          <select
            value={spotlight.motion}
            onChange={(e) =>
              onChange({ motion: e.target.value as SpotlightConfig["motion"] })
            }
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            <option value="mouse">Follow mouse</option>
            <option value="sweep-left">Sweep → (left to right)</option>
            <option value="sweep-right">Sweep ← (right to left)</option>
          </select>
        </label>

        {(spotlight.motion === "sweep-left" || spotlight.motion === "sweep-right") && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Sweep Y (px)</span>
            <input
              type="number"
              step={5}
              value={spotlight.sweepY ?? 0}
              onChange={(e) =>
                onChange({ sweepY: parseFloat(e.target.value) || 0 })
              }
              className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
            <span className="text-[10px] text-neutral-400">
              Leave 0 for center
            </span>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Size (px)</span>
          <input
            type="number"
            min={10}
            step={10}
            value={spotlight.size}
            onChange={(e) => onChange({ size: Math.max(10, parseInt(e.target.value, 10) || 10) })}
            className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Opacity <span className="text-[10px] text-neutral-400">0–1</span></span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={+spotlight.opacity.toFixed(2)}
            onChange={(e) =>
              onChange({
                opacity: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)),
              })
            }
            className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>

        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Color</span>
          <ColorPicker
            value={spotlight.color}
            onChange={(c) => onChange({ color: c })}
            title="Spotlight color"
            size="md"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Feather edge (px)</span>
          <input
            type="number"
            min={0}
            step={2}
            value={spotlight.featherPx ?? 0}
            onChange={(e) =>
              onChange({ featherPx: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>

        <label className="col-span-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={Boolean(spotlight.maskText)}
            onChange={(e) => onChange({ maskText: e.target.checked })}
            className="h-3.5 w-3.5 cursor-pointer"
          />
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            Mask text
          </span>
          <span className="text-neutral-500">apply spotlight as a text mask</span>
        </label>

        {spotlight.maskText && (
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Mask mode</span>
            <div className="flex gap-1">
              <ShapeBtn
                active={(spotlight.maskMode ?? "tint") === "tint"}
                onClick={() => onChange({ maskMode: "tint" })}
                label="Tint inside (recolor)"
              />
              <ShapeBtn
                active={spotlight.maskMode === "reveal"}
                onClick={() => onChange({ maskMode: "reveal" })}
                label="Reveal inside (hide outside)"
              />
            </div>
          </label>
        )}

        <label className="col-span-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={spotlight.showBackdrop !== false}
            onChange={(e) => onChange({ showBackdrop: e.target.checked })}
            className="h-3.5 w-3.5 cursor-pointer"
          />
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            Show backdrop
          </span>
          <span className="text-neutral-500">render the colored shape behind text</span>
        </label>
      </div>
    </div>
  );
}

function ShapeBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded border px-2 py-1 text-xs ${
        active
          ? "border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-500/60 dark:bg-sky-900/30 dark:text-sky-100"
          : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}

interface ParticleConfig {
  density: number;
  size: number;
  color: string;
  preset: "gold" | "silver" | "rainbow" | "fire" | "custom";
  shape?: "star" | "circle" | "diamond" | "square";
  type?: ParticleType;
  mode?: "component" | "around" | "follow" | "hover";
  rangePx?: number;
  spawnRadiusPx?: number;
  lifespanSec?: number;
  sizeJitter?: number;
  rotationSpeed?: number;
  continueAfter?: boolean;
}

interface ParticlePanelProps {
  particle: ParticleConfig;
  onChange: (update: Partial<ParticleConfig>) => void;
}

function ParticlePreview({ config }: { config: ParticleConfig }) {
  const [, tick] = useState(0);
  const ct = config.type ?? "standard";
  const w = 180;
  const h = 72;
  const lifespan = config.lifespanSec ?? 0.6;
  const density = config.density;
  const sizeBase = config.size * 0.5;
  const sizeJitter = config.sizeJitter ?? 0.4;
  const rotSpeed = config.rotationSpeed ?? 0;
  const preset = config.preset;
  const shape = config.shape ?? "star";
  const d = (PARTICLE_SHAPES as Record<string, string>)[shape] ?? PARTICLE_SHAPES.star;

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, []);

  const now = (Date.now() / 1000) % 10;
  const total = Math.max(1, Math.round(density * lifespan));
  const cyclesSince = Math.floor(now / lifespan);
  const particles: Array<{
    key: string;
    x: number;
    y: number;
    size: number;
    color: string;
    opacity: number;
    rotation: number;
    scale: number;
  }> = [];

  for (let cycle = cyclesSince - 1; cycle <= cyclesSince; cycle++) {
    if (cycle < 0) continue;
    const anchor = cycle * lifespan;
    for (let i = 0; i < total; i++) {
      const spawnT = anchor + (i / total) * lifespan;
      const age = now - spawnT;
      if (age < 0 || age > lifespan) continue;
      const seed = hash(`preview_${i}_c${cycle}_${ct === "standard" ? Math.floor(now * 10) : ""}`);
      const path = particlePath(ct, seed, w, h, 0, age, lifespan);
      if (!path) continue;
      const baseRot = pseudo(seed, 3) * 360;
      const rotation = baseRot + rotSpeed * age;
      const sizeMul = 1 + (pseudo(seed, 4) - 0.5) * 2 * sizeJitter;
      const size = Math.max(2, sizeBase * sizeMul);
      const colorFn = PRESET_COLOR_FNS[preset] ?? PRESET_COLOR_FNS.gold;
      const color = colorFn(i, config.color);
      particles.push({
        key: `prev_${cycle}_${i}`,
        x: path.x,
        y: path.y,
        size,
        color,
        opacity: path.opacity,
        rotation,
        scale: path.scale ?? 1,
      });
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded border border-neutral-300 bg-neutral-200 dark:border-neutral-700 dark:bg-black"
      style={{ width: w, height: h }}
    >
      {particles.map((p) => {
        const es = p.size * p.scale;
        return (
          <svg
            key={p.key}
            width={es}
            height={es}
            viewBox="0 0 24 24"
            className="absolute"
            style={{
              left: p.x - es / 2,
              top: p.y - es / 2,
              opacity: p.opacity,
              transform: `rotate(${p.rotation}deg)`,
              pointerEvents: "none",
            }}
          >
            <path d={d} fill={p.color} />
          </svg>
        );
      })}
    </div>
  );
}

function ParticlePanel({ particle, onChange }: ParticlePanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs uppercase tracking-wider text-neutral-500">
        Particle
      </div>
      <ParticlePreview config={particle} />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-neutral-500">Particle type</span>
        <ParticleTypePicker
          value={particle.type ?? "standard"}
          onChange={(t) => onChange({ type: t })}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Preset</span>
          <select
            value={particle.preset}
            onChange={(e) =>
              onChange({ preset: e.target.value as ParticleConfig["preset"] })
            }
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="rainbow">Rainbow</option>
            <option value="fire">Fire</option>
            <option value="custom">Custom (single color)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Shape</span>
          <select
            value={particle.shape ?? "star"}
            onChange={(e) =>
              onChange({ shape: e.target.value as ParticleConfig["shape"] })
            }
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            <option value="star">Star</option>
            <option value="circle">Circle</option>
            <option value="diamond">Diamond</option>
            <option value="square">Square</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Where</span>
          <select
            value={particle.mode ?? "component"}
            onChange={(e) =>
              onChange({ mode: e.target.value as NonNullable<ParticleConfig["mode"]> })
            }
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            <option value="component">On the text</option>
            <option value="around">Around the text</option>
            <option value="follow">Follow the cursor</option>
            <option value="hover">Hover the text</option>
          </select>
        </label>

        {(particle.mode === "component" || particle.mode === "around") && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Spread (px)</span>
            <input
              type="number"
              min={0}
              step={5}
              value={particle.rangePx ?? (particle.mode === "around" ? 20 : 0)}
              onChange={(e) =>
                onChange({ rangePx: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Density (per sec)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={particle.density}
            onChange={(e) =>
              onChange({
                density: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Size (px)</span>
          <input
            type="number"
            min={4}
            step={2}
            value={particle.size}
            onChange={(e) =>
              onChange({ size: Math.max(4, parseInt(e.target.value, 10) || 4) })
            }
            className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>

        {particle.preset === "custom" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Color</span>
            <ColorPicker
              value={particle.color}
              onChange={(c) => onChange({ color: c })}
              title="Particle color"
              size="md"
            />
          </label>
        )}

        {(particle.mode === "follow" || particle.mode === "hover") && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Cursor jitter (px)</span>
            <input
              type="number"
              min={0}
              step={2}
              value={particle.spawnRadiusPx ?? 30}
              onChange={(e) =>
                onChange({
                  spawnRadiusPx: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
              }
              className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Lifespan (s)</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={+(particle.lifespanSec ?? 0.6).toFixed(2)}
            onChange={(e) =>
              onChange({
                lifespanSec: Math.max(0.1, parseFloat(e.target.value) || 0.1),
              })
            }
            className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Size jitter (±%)</span>
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={Math.round((particle.sizeJitter ?? 0.4) * 100)}
            onChange={(e) =>
              onChange({
                sizeJitter: Math.max(
                  0,
                  Math.min(1, (parseInt(e.target.value, 10) || 0) / 100),
                ),
              })
            }
            className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Rotation speed (°/s)</span>
          <input
            type="number"
            step={15}
            value={particle.rotationSpeed ?? 0}
            onChange={(e) =>
              onChange({ rotationSpeed: parseFloat(e.target.value) || 0 })
            }
            className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>

        <label className="col-span-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={Boolean(particle.continueAfter)}
            onChange={(e) => onChange({ continueAfter: e.target.checked })}
            className="h-3.5 w-3.5 cursor-pointer"
          />
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            Run Continuously
          </span>
          <span className="text-neutral-500">
            keep particles spawning past the effect's end time
          </span>
        </label>
      </div>
    </div>
  );
}

interface FireworksPanelProps {
  fireworks: {
    density: number;
    explosion: number;
    gravity?: number;
    opacity?: number;
    flickering?: number;
    acceleration?: number;
    friction?: number;
    traceLength?: number;
    traceSpeed?: number;
    intensity?: number;
    lineStyle?: "round" | "square";
    followMouse?: boolean;
    rocketsSpread?: number;
    mode?: "component" | "around";
    spreadRadius?: number;
    delayMin?: number;
    delayMax?: number;
    brightnessMin?: number;
    brightnessMax?: number;
    decayMin?: number;
    decayMax?: number;
    hueMin?: number;
    hueMax?: number;
    rocketsPointMin?: number;
    rocketsPointMax?: number;
    lineWidthExpMin?: number;
    lineWidthExpMax?: number;
    lineWidthTraceMin?: number;
    lineWidthTraceMax?: number;
    continueAfter?: boolean;
  };
  onChange: (update: Partial<FireworksPanelProps["fireworks"]>) => void;
}

function DualSlider({ label, title, min, max, step, minVal, maxVal, onChange, unit }: {
  label: string; title?: string; min: number; max: number; step: number;
  minVal: number; maxVal: number; unit?: string;
  onChange: (min: number, max: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1" title={title}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">{label}</span>
        <span className="text-[10px] tabular-nums text-neutral-400">
          {step >= 1 ? minVal : minVal.toFixed(step < 0.01 ? 3 : 2)} – {step >= 1 ? maxVal : maxVal.toFixed(step < 0.01 ? 3 : 2)}{unit ?? ""}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="range"
          min={min} max={max} step={step}
          value={minVal}
          onChange={(e) => { const v = parseFloat(e.target.value); onChange(Math.min(v, maxVal), maxVal); }}
          className="h-4 flex-1 cursor-pointer appearance-none rounded bg-neutral-200 accent-sky-500 dark:bg-neutral-700"
        />
        <input
          type="range"
          min={min} max={max} step={step}
          value={maxVal}
          onChange={(e) => { const v = parseFloat(e.target.value); onChange(minVal, Math.max(v, minVal)); }}
          className="h-4 flex-1 cursor-pointer appearance-none rounded bg-neutral-200 accent-amber-500 dark:bg-neutral-700"
        />
      </div>
    </label>
  );
}

function SliderField({ label, title, value, min, max, step, onChange }: {
  label: string; title?: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1" title={title}>
      <span className="text-xs text-neutral-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-4 w-full cursor-pointer appearance-none rounded bg-neutral-200 accent-sky-500 dark:bg-neutral-700"
        />
        <span className="w-12 text-right text-xs tabular-nums text-neutral-700 dark:text-neutral-300">
          {step >= 1 ? value : value.toFixed(step < 0.01 ? 3 : 2)}
        </span>
      </div>
    </label>
  );
}

function FireworksPanel({ fireworks, onChange }: FireworksPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs uppercase tracking-wider text-neutral-500">
        Fireworks (library)
      </div>
      <div className="rounded border border-amber-300 bg-amber-50 p-2 dark:border-amber-800/60 dark:bg-amber-900/20">
        <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
          Powered by <a href="https://github.com/crashmax-dev/fireworks-js" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">fireworks-js</a> &copy; crashmax-dev (MIT license).
        </p>
        <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
          Canvas fireworks engine. Preview-only (not exported to Motion JSX).
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SliderField title="Total particles per rocket explosion" label="Particles" value={fireworks.density} min={1} max={200} step={5} onChange={(v) => onChange({ density: v })} />
        <SliderField title="Number of sub-explosions per rocket" label="Explosion" value={fireworks.explosion} min={1} max={20} step={1} onChange={(v) => onChange({ explosion: v })} />
        <SliderField title="Downward gravity pull on particles" label="Gravity" value={fireworks.gravity ?? 1.5} min={0.1} max={5} step={0.1} onChange={(v) => onChange({ gravity: v })} />
        <SliderField title="Particle transparency level" label="Opacity" value={fireworks.opacity ?? 0.5} min={0.1} max={1} step={0.05} onChange={(v) => onChange({ opacity: v })} />
        <SliderField title="Random flicker intensity percentage" label="Flickering" value={fireworks.flickering ?? 50} min={0} max={100} step={5} onChange={(v) => onChange({ flickering: v })} />
        <SliderField title="Particle speed increase over time" label="Acceleration" value={fireworks.acceleration ?? 1.05} min={1} max={1.1} step={0.01} onChange={(v) => onChange({ acceleration: v })} />
        <SliderField title="Air resistance slowing particles" label="Friction" value={fireworks.friction ?? 0.97} min={0.9} max={1} step={0.01} onChange={(v) => onChange({ friction: v })} />
        <SliderField title="Length of particle trail behind" label="Trace len" value={fireworks.traceLength ?? 3} min={1} max={10} step={1} onChange={(v) => onChange({ traceLength: v })} />
        <SliderField title="How quickly the trail fades out" label="Trace speed" value={fireworks.traceSpeed ?? 10} min={1} max={20} step={1} onChange={(v) => onChange({ traceSpeed: v })} />
        <SliderField title="Rocket launch power / height" label="Intensity" value={fireworks.intensity ?? 30} min={10} max={100} step={5} onChange={(v) => onChange({ intensity: v })} />
        <SliderField title="Horizontal launch spread as % of width" label="Spread %" value={fireworks.rocketsSpread ?? 80} min={10} max={100} step={5} onChange={(v) => onChange({ rocketsSpread: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Where</span>
          <select
            value={fireworks.mode ?? "component"}
            onChange={(e) => onChange({ mode: e.target.value as "component" | "around" })}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            <option value="component">On the text</option>
            <option value="around">Around the text</option>
          </select>
        </label>
        <SliderField label="Spread radius (px)" value={fireworks.spreadRadius ?? 100} min={0} max={500} step={10} onChange={(v) => onChange({ spreadRadius: v })} />
      </div>
      <DualSlider title="Milliseconds between rocket launches (randomized in range)" label="Delay (ms)" min={10} max={2000} step={10}
        minVal={fireworks.delayMin ?? 50} maxVal={fireworks.delayMax ?? 200}
        onChange={(min, max) => onChange({ delayMin: min, delayMax: Math.max(min, max) })} />
      <DualSlider title="Particle brightness range" label="Brightness" min={0} max={100} step={5}
        minVal={fireworks.brightnessMin ?? 50} maxVal={fireworks.brightnessMax ?? 80}
        onChange={(min, max) => onChange({ brightnessMin: min, brightnessMax: Math.max(min, max) })} />
      <DualSlider title="Particle fade-out speed range" label="Decay" min={0.005} max={0.05} step={0.005}
        minVal={fireworks.decayMin ?? 0.015} maxVal={fireworks.decayMax ?? 0.03}
        onChange={(min, max) => onChange({ decayMin: min, decayMax: Math.max(min, max) })} />
      <DualSlider title="Color hue range (0=red, 120=green, 240=blue, 360=red again)" label="Hue" min={0} max={360} step={5}
        minVal={fireworks.hueMin ?? 0} maxVal={fireworks.hueMax ?? 360}
        onChange={(min, max) => onChange({ hueMin: min, hueMax: Math.max(min, max) })} />
      <DualSlider title="Launch position along bottom edge as % (50=center)" label="Rockets point %" min={0} max={100} step={5}
        minVal={fireworks.rocketsPointMin ?? 30} maxVal={fireworks.rocketsPointMax ?? 70}
        onChange={(min, max) => onChange({ rocketsPointMin: min, rocketsPointMax: Math.max(min, max) })} />
      <DualSlider title="Line thickness for explosion particles" label="Line width (explosion)" min={1} max={10} step={1}
        minVal={fireworks.lineWidthExpMin ?? 1} maxVal={fireworks.lineWidthExpMax ?? 3}
        onChange={(min, max) => onChange({ lineWidthExpMin: min, lineWidthExpMax: Math.max(min, max) })} />
      <DualSlider title="Line thickness for trail particles" label="Line width (trace)" min={1} max={5} step={1}
        minVal={fireworks.lineWidthTraceMin ?? 1} maxVal={fireworks.lineWidthTraceMax ?? 2}
        onChange={(min, max) => onChange({ lineWidthTraceMin: min, lineWidthTraceMax: Math.max(min, max) })} />
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={Boolean(fireworks.followMouse)}
            onChange={(e) => onChange({ followMouse: e.target.checked })}
            className="h-3.5 w-3.5 cursor-pointer"
          />
          <span className="text-neutral-700 dark:text-neutral-300">Follow mouse</span>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-neutral-500">Line style</span>
          <select
            value={fireworks.lineStyle ?? "round"}
            onChange={(e) => onChange({ lineStyle: e.target.value as "round" | "square" })}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            <option value="round">Round</option>
            <option value="square">Square</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={Boolean(fireworks.continueAfter)}
          onChange={(e) => onChange({ continueAfter: e.target.checked })}
          className="h-3.5 w-3.5 cursor-pointer"
        />
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          Run Continuously
        </span>
        <span className="text-neutral-500">
          keep launching past the effect's end time
        </span>
      </label>
    </div>
  );
}

interface TypewriterPanelProps {
  typewriter: { mode: "snap" | "fade" };
  onChange: (update: Partial<{ mode: "snap" | "fade" }>) => void;
}

function TypewriterPanel({ typewriter, onChange }: TypewriterPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs uppercase tracking-wider text-neutral-500">
        Typewriter
      </div>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Reveal style</span>
        <div className="flex gap-1">
          <ShapeBtn
            active={typewriter.mode === "snap"}
            onClick={() => onChange({ mode: "snap" })}
            label="Snap"
          />
          <ShapeBtn
            active={typewriter.mode === "fade"}
            onClick={() => onChange({ mode: "fade" })}
            label="Fade"
          />
        </div>
        <span className="mt-1 text-neutral-500">
          Each letter appears across the effect duration. Snap = instant
          per letter, Fade = each letter eases in.
        </span>
      </label>
    </div>
  );
}

interface PresetBarProps {
  effect: {
    type: EffectType;
    duration: number;
    easing: import("../../types/project").EasingType;
    from?: AnimatableTargets;
    targets: AnimatableTargets;
    spotlight?: import("../../types/project").Effect["spotlight"];
    particle?: import("../../types/project").Effect["particle"];
    typewriter?: import("../../types/project").Effect["typewriter"];
    staggerLetters?: boolean;
    staggerDelay?: number;
  };
  onApply: (cfg: PresetConfig) => void;
}

function PresetBar({ effect, onApply }: PresetBarProps) {
  const presets = usePresetStore((s) => s.presets);
  const loaded = usePresetStore((s) => s.loaded);
  const refresh = usePresetStore((s) => s.refresh);
  const savePreset = usePresetStore((s) => s.save);
  const removePreset = usePresetStore((s) => s.remove);
  const exportPreset = usePresetStore((s) => s.exportPreset);
  const importPreset = usePresetStore((s) => s.importPreset);
  const [namingOpen, setNamingOpen] = useState(false);
  const [name, setName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!loaded) refresh();
  }, [loaded, refresh]);

  const matching = presets.filter((p) => p.effectType === effect.type);

  const onSave = async () => {
    if (!name.trim()) return;
    const cfg: PresetConfig = {
      type: effect.type,
      duration: effect.duration,
      easing: effect.easing,
      from: effect.from,
      targets: effect.targets,
      spotlight: effect.spotlight,
      particle: effect.particle,
      typewriter: effect.typewriter,
      staggerLetters: effect.staggerLetters,
      staggerDelay: effect.staggerDelay,
    };
    await savePreset(name.trim(), effect.type, cfg);
    setName("");
    setNamingOpen(false);
  };

  const onLoad = (id: string) => {
    setSelectedId(id);
    if (!id) return;
    const p = presets.find((x) => x.id === id);
    if (p) onApply(p.config);
  };

  const onExport = async () => {
    if (!selectedId) return;
    const json = exportPreset(selectedId);
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      // Fallback: show in textarea via the import area
      setImportText(json);
      setImportOpen(true);
    }
  };

  const onImport = async () => {
    const rec = await importPreset(importText);
    if (rec) {
      setImportText("");
      setImportOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-200 bg-neutral-50 p-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2">
        <span className="font-medium uppercase tracking-wider text-neutral-500">
          Presets
        </span>
        <select
          value={selectedId}
          onChange={(e) => onLoad(e.target.value)}
          className="flex-1 rounded border border-neutral-300 bg-white px-2 py-0.5 text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        >
          <option value="">— Load preset —</option>
          {matching.length > 0 && (
            <optgroup label={`For ${EFFECT_LABELS[effect.type]}`}>
              {matching.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
          {presets.length > matching.length && (
            <optgroup label="Other types">
              {presets
                .filter((p) => p.effectType !== effect.type)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({EFFECT_LABELS[p.effectType]})
                  </option>
                ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          onClick={() => setNamingOpen((v) => !v)}
          className="flex items-center gap-1 rounded border border-neutral-300 bg-white px-2 py-0.5 text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
        >
          <Copy size={11} />
          Save preset…
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={!selectedId}
          title="Copy selected preset's JSON to clipboard"
          className="flex items-center gap-1 rounded border border-neutral-300 bg-white px-2 py-0.5 text-neutral-800 enabled:hover:border-neutral-500 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
        >
          <Download size={11} />
          Export
        </button>
        <button
          type="button"
          onClick={() => setImportOpen((v) => !v)}
          className="flex items-center gap-1 rounded border border-neutral-300 bg-white px-2 py-0.5 text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
        >
          <Upload size={11} />
          Import
        </button>
        {selectedId && (
          <button
            type="button"
            onClick={async () => {
              await removePreset(selectedId);
              setSelectedId("");
            }}
            title="Delete the selected preset"
            className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-900/30"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      {namingOpen && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Preset name"
            className="flex-1 rounded border border-neutral-300 bg-white px-2 py-0.5 text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
          <button
            type="button"
            onClick={onSave}
            disabled={!name.trim()}
            className="rounded bg-sky-500 px-2 py-0.5 text-white enabled:hover:bg-sky-400 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      )}
      {importOpen && (
        <div className="flex flex-col gap-1">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste preset JSON here…"
            rows={4}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 font-mono text-[11px] text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
          <button
            type="button"
            onClick={onImport}
            disabled={!importText.trim()}
            className="self-end rounded bg-sky-500 px-2 py-0.5 text-white enabled:hover:bg-sky-400 disabled:opacity-40"
          >
            Import preset
          </button>
        </div>
      )}
    </div>
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
  const [draft, setDraft] = useState<string | null>(null);

  if (prop === "color") {
    const v = typeof value === "string" ? value : "#ffffff";
    return (
      <div className="flex items-center gap-1.5">
        <ColorPicker
          value={v}
          onChange={(c) => onChange(c)}
          title="Color value"
          size="sm"
        />
      </div>
    );
  }

  const v = typeof value === "number" ? value : 0;
  const step = prop === "opacity" || prop === "scale" ? 0.05 : 1;
  const decimals = prop === "rotation" ? 0 : 2;

  const display =
    draft !== null
      ? draft
      : Number.isFinite(v)
        ? +v.toFixed(decimals)
        : 0;

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) {
      setDraft(null);
      onChange(n);
    } else {
      setDraft(raw);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        inputMode="decimal"
        step={step}
        value={display}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => {
          if (draft !== null) {
            setDraft(null);
          }
        }}
        className="w-20 rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />
      {unit ? (
        <span className="text-[11px] text-neutral-400">{unit}</span>
      ) : prop === "opacity" ? (
        <span className="text-[10px] text-neutral-400">0–1</span>
      ) : prop === "scale" ? (
        <span className="text-[10px] text-neutral-400">1 = 100%</span>
      ) : null}
    </div>
  );
}
