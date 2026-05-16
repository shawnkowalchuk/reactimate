import { AlignCenter, AlignLeft, AlignRight, Trash2 } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { useSelectionStore } from "../../store/selectionStore";
import { CANVAS_PRESETS } from "../../constants/presets";
import { FONTS } from "../../constants/fonts";
import type {
  CanvasPreset,
  Component,
  ComponentStyle,
  Project,
} from "../../types/project";
import { EffectModal } from "./EffectModal";
import { FontPicker } from "./FontPicker";
import { ColorPicker } from "../ui/ColorPicker";
import { NumberInput } from "../ui/NumberInput";

const numberInput =
  "w-16 rounded border border-neutral-300 bg-white px-1 py-0.5 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const numberInputWide =
  "w-20 rounded border border-neutral-300 bg-white px-1 py-0.5 text-neutral-900 tabular-nums focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const selectInput =
  "rounded border border-neutral-300 bg-white px-1 py-0.5 text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

export function InspectorBar() {
  const project = useProjectStore((s) => s.project);
  const selectionTarget = useSelectionStore((s) => s.target);

  const components = project.layer.components;

  // The component row should show whenever a component OR one of its
  // effects is selected — so the user keeps the parent context visible
  // even while the EffectModal is open.
  const contextComponentId =
    selectionTarget.kind === "component"
      ? selectionTarget.componentId
      : selectionTarget.kind === "effect"
        ? selectionTarget.componentId
        : null;
  const contextComponent: Component | null = contextComponentId
    ? components.find((c) => c.id === contextComponentId) ?? null
    : null;

  return (
    <>
      <div className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <div className="min-h-[44px] px-3 py-2">
          <ProjectInspectorStrip project={project} />
        </div>
        {contextComponent && (
          <div className="min-h-[44px] border-t border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
            <ComponentInspectorStrip
              component={contextComponent}
              text={project.layer.text.slice(
                contextComponent.startIndex,
                contextComponent.endIndex,
              )}
            />
          </div>
        )}
      </div>

      <EffectModal />
    </>
  );
}

interface ComponentInspectorProps {
  component: Component;
  text: string;
}

function ComponentInspectorStrip({ component, text }: ComponentInspectorProps) {
  const updateComponentStyle = useProjectStore((s) => s.updateComponentStyle);
  const setAlignment = useProjectStore((s) => s.setAlignment);
  const layerAlignment = useProjectStore((s) => s.project.layer.alignment);
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

  const onFontChange = (family: string) => {
    const next = FONTS.find((f) => f.family === family) ?? FONTS[0];
    const nextWeight = next.weights.includes(component.style.fontWeight)
      ? component.style.fontWeight
      : next.weights[0];
    patch({ fontFamily: family, fontWeight: nextWeight });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: component.color }}
      />
      <span className="font-medium text-neutral-900 dark:text-neutral-200">Component</span>
      <span className="text-neutral-500">on</span>
      <span className="font-mono text-neutral-700 dark:text-neutral-300">"{text}"</span>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Font</span>
        <FontPicker value={component.style.fontFamily} onChange={onFontChange} />
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Wt</span>
        <select
          value={safeWeight}
          onChange={(e) => patch({ fontWeight: parseInt(e.target.value, 10) })}
          className={selectInput}
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
        <NumberInput
          min={8}
          max={400}
          step={2}
          value={component.style.fontSize}
          format={(v) => String(Math.round(v))}
          onChange={(v) =>
            patch({ fontSize: Math.max(8, Math.min(400, Math.round(v))) })
          }
          className={numberInput}
        />
        <span className="text-neutral-400 dark:text-neutral-600">px</span>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Color</span>
        <ColorPicker
          value={component.style.color}
          onChange={(c) => patch({ color: c })}
          title="Component text color"
        />
      </label>

      {/* Alignment is a LAYER property in the data model (RenderedText
          applies textAlign to the single text block — components are
          inline spans inside it, so per-component align would require
          breaking each into its own block, changing word flow). Writing
          to component.style.alignment was a dead field — wire to the
          layer setter so the buttons actually affect the preview. */}
      <div className="flex items-center gap-0.5 rounded border border-neutral-300 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-900">
        <AlignBtn
          active={layerAlignment === "left"}
          onClick={() => setAlignment("left")}
          icon={<AlignLeft size={12} />}
          label="Align left"
        />
        <AlignBtn
          active={layerAlignment === "center"}
          onClick={() => setAlignment("center")}
          icon={<AlignCenter size={12} />}
          label="Align center"
        />
        <AlignBtn
          active={layerAlignment === "right"}
          onClick={() => setAlignment("right")}
          icon={<AlignRight size={12} />}
          label="Align right"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          removeComponent(component.id);
          selectNone();
        }}
        className="ml-auto flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-2 py-0.5 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-900/30"
        title="Remove this component (returns its text to the layer default style)"
      >
        <Trash2 size={12} />
        Remove component
      </button>
    </div>
  );
}

interface AlignBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function AlignBtn({ active, onClick, icon, label }: AlignBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`rounded p-0.5 ${
        active
          ? "bg-sky-500 text-white"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      }`}
    >
      {icon}
    </button>
  );
}

function ProjectInspectorStrip({ project }: { project: Project }) {
  const setCanvasPreset = useProjectStore((s) => s.setCanvasPreset);
  const setCanvasSize = useProjectStore((s) => s.setCanvasSize);
  const setBackground = useProjectStore((s) => s.setBackground);
  const setDuration = useProjectStore((s) => s.setDuration);
  const setName = useProjectStore((s) => s.setName);
  const updateComponentStyle = useProjectStore((s) => s.updateComponentStyle);

  // The "default text color" is stored on project.defaultTextStyle and also
  // mirrored on each component's style.color. Keep both in sync when the
  // user flips between dark/light targets.
  const setDefaultTextColor = (color: string) => {
    const oldColor = project.defaultTextStyle.color;
    useProjectStore.setState((state) => ({
      project: {
        ...state.project,
        defaultTextStyle: { ...state.project.defaultTextStyle, color },
      },
    }));
    if (color !== oldColor) {
      for (const c of project.layer.components) {
        if (normalizeCss(c.style.color) === normalizeCss(oldColor)) {
          updateComponentStyle(c.id, { color });
        }
      }
    }
  };

  const applyPreset = (bg: string, fg: string) => {
    setBackground(bg);
    setDefaultTextColor(fg);
  };

  const presetSpec =
    CANVAS_PRESETS.find((p) => p.preset === project.canvas.preset) ??
    CANVAS_PRESETS[0];
  const isCustom = presetSpec.preset === "custom";
  const ratio = presetSpec.width / presetSpec.height;

  // For named presets the W/H stay locked to the preset's aspect ratio.
  // For "Custom" the user can set W and H independently.
  const onWidthChange = (w: number) => {
    if (!Number.isFinite(w) || w <= 0) return;
    if (isCustom) {
      setCanvasSize(w, project.canvas.height);
    } else {
      setCanvasSize(w, w / ratio);
    }
  };
  const onHeightChange = (h: number) => {
    if (!Number.isFinite(h) || h <= 0) return;
    if (isCustom) {
      setCanvasSize(project.canvas.width, h);
    } else {
      setCanvasSize(h * ratio, h);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-medium text-neutral-900 dark:text-neutral-200">Project</span>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Name</span>
        <input
          type="text"
          value={project.name}
          onChange={(e) => setName(e.target.value)}
          className="w-32 rounded border border-neutral-300 bg-white px-1 py-0.5 text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Dur</span>
        <NumberInput
          step={0.1}
          min={0.1}
          value={project.duration}
          format={(v) => String(+v.toFixed(2))}
          onChange={(v) => setDuration(Math.max(0.1, v))}
          className={numberInput}
        />
        <span className="text-neutral-400 dark:text-neutral-600">s</span>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Canvas</span>
        <select
          value={project.canvas.preset}
          onChange={(e) => setCanvasPreset(e.target.value as CanvasPreset)}
          className={selectInput}
        >
          {CANVAS_PRESETS.map((p) => (
            <option key={p.preset} value={p.preset}>
              {p.label}
            </option>
          ))}
        </select>
        <NumberInput
          min={1}
          step={1}
          value={project.canvas.width}
          format={(v) => String(Math.round(v))}
          onChange={(v) => onWidthChange(Math.max(1, Math.round(v)))}
          className={numberInputWide}
          title={
            isCustom
              ? "Width (free — Custom preset)"
              : `Width (locked to ${presetSpec.preset} aspect ratio)`
          }
        />
        <span className="text-neutral-400 dark:text-neutral-600">×</span>
        <NumberInput
          min={1}
          step={1}
          value={project.canvas.height}
          format={(v) => String(Math.round(v))}
          onChange={(v) => onHeightChange(Math.max(1, Math.round(v)))}
          className={numberInputWide}
          title={
            isCustom
              ? "Height (free — Custom preset)"
              : `Height (locked to ${presetSpec.preset} aspect ratio)`
          }
        />
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Bg</span>
        <ColorPicker
          value={project.canvas.background}
          onChange={setBackground}
          title="Canvas background"
        />
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Text</span>
        <ColorPicker
          value={project.defaultTextStyle.color}
          onChange={setDefaultTextColor}
          title="Default text color"
        />
      </label>

      <div className="ml-auto flex items-center gap-1 text-[11px]">
        <span className="text-neutral-500">Quick:</span>
        <button
          type="button"
          onClick={() => applyPreset("#0a0a0a", "#fafafa")}
          className="rounded border border-neutral-300 bg-neutral-900 px-2 py-0.5 text-neutral-50 hover:opacity-80 dark:border-neutral-700"
        >
          Dark site
        </button>
        <button
          type="button"
          onClick={() => applyPreset("#ffffff", "#0a0a0a")}
          className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-neutral-900 hover:opacity-80 dark:border-neutral-700"
        >
          Light site
        </button>
      </div>
    </div>
  );
}

function normalizeCss(color: string): string {
  if (typeof document === "undefined") return color;
  const el = document.createElement("div");
  el.style.color = color;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);
  return rgb;
}
