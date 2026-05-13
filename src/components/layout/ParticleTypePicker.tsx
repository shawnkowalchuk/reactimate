import { useRef } from "react";

export type ParticleType = "standard" | "fireworks" | "volcano" | "dropping";

const TYPE_LIST: ParticleType[] = ["standard", "fireworks", "volcano", "dropping"];
const TYPE_LABEL: Record<ParticleType, string> = {
  standard: "Standard",
  fireworks: "Fireworks",
  volcano: "Volcano",
  dropping: "Dropping",
};

const CELL_W = 80;
const CELL_H = 50;
const CELL_PAD = 4;

interface Props {
  value: ParticleType;
  onChange: (next: ParticleType) => void;
}

/**
 * Two synced controls for picking a particle type:
 *  1. A 4-cell grid where each cell shows a mini SVG diagram + name.
 *  2. A horizontal slider beneath with 4 ticks and a draggable handle.
 *
 * Selecting in either control updates the other.
 */
export function ParticleTypePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5">
        {TYPE_LIST.map((t) => {
          const active = t === value;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              aria-pressed={active}
              className={`flex flex-col items-center gap-0.5 rounded border p-1.5 text-[10px] transition-colors ${
                active
                  ? "border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-500/60 dark:bg-sky-900/30 dark:text-sky-100"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-500"
              }`}
            >
              <TypePreview type={t} active={active} />
              <span className="font-mono">{TYPE_LABEL[t]}</span>
            </button>
          );
        })}
      </div>
      <TypeSlider value={value} onChange={onChange} />
    </div>
  );
}

function TypePreview({ type, active }: { type: ParticleType; active: boolean }) {
  const stroke = active ? "rgb(56, 189, 248)" : "currentColor";
  const fill = active ? "rgb(56, 189, 248)" : "currentColor";
  // Each preview is a 60x36 viewBox sketch of the particle behavior.
  return (
    <svg
      width={CELL_W - CELL_PAD * 2}
      height={CELL_H - CELL_PAD * 2 - 14}
      viewBox="0 0 60 36"
      className="overflow-visible"
    >
      {type === "standard" && (
        <>
          {/* Random stars scattered in a box */}
          {[
            [10, 10],
            [25, 8],
            [40, 18],
            [50, 12],
            [15, 24],
            [35, 28],
            [48, 28],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.5}
              fill={fill}
              opacity={0.85}
            />
          ))}
        </>
      )}
      {type === "fireworks" && (
        <>
          {/* Burst lines + dots radiating from center */}
          {Array.from({ length: 8 }).map((_, i) => {
            const ang = (i / 8) * Math.PI * 2;
            const cx = 30;
            const cy = 18;
            const r1 = 6;
            const r2 = 14;
            return (
              <g key={i}>
                <line
                  x1={cx + Math.cos(ang) * r1}
                  y1={cy + Math.sin(ang) * r1}
                  x2={cx + Math.cos(ang) * r2}
                  y2={cy + Math.sin(ang) * r2}
                  stroke={stroke}
                  strokeWidth={1}
                  opacity={0.5}
                />
                <circle
                  cx={cx + Math.cos(ang) * r2}
                  cy={cy + Math.sin(ang) * r2}
                  r={1.4}
                  fill={fill}
                />
              </g>
            );
          })}
          <circle cx={30} cy={18} r={1.8} fill={fill} opacity={0.7} />
        </>
      )}
      {type === "volcano" && (
        <>
          {/* Parabolic arc from bottom center */}
          {Array.from({ length: 9 }).map((_, i) => {
            const t = i / 8;
            const x = 30 + (t - 0.5) * 36;
            const y = 32 - Math.sin(t * Math.PI) * 24;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={1.4}
                fill={fill}
                opacity={0.85}
              />
            );
          })}
          <line
            x1={6}
            y1={34}
            x2={54}
            y2={34}
            stroke={stroke}
            strokeWidth={0.5}
            opacity={0.3}
          />
        </>
      )}
      {type === "dropping" && (
        <>
          {/* Streaks falling from top to bottom */}
          {[8, 18, 28, 38, 48].map((x, i) => (
            <g key={i}>
              <line
                x1={x}
                y1={2}
                x2={x}
                y2={28}
                stroke={stroke}
                strokeWidth={0.7}
                opacity={0.35}
              />
              <circle cx={x} cy={28} r={1.4} fill={fill} />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}

function TypeSlider({ value, onChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const idx = Math.max(0, TYPE_LIST.indexOf(value));

  // Capture the wrapper's rect ONCE at pointerdown and reuse for every
  // pointermove. The slider track sits at a fixed left/width regardless
  // of which tick is selected, so the captured rect stays correct even
  // as React re-renders the handle position mid-drag.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.setPointerCapture(e.pointerId);
    const r = wrap.getBoundingClientRect();

    const apply = (clientX: number) => {
      const pct = (clientX - r.left) / Math.max(1, r.width);
      const clamped = Math.max(0, Math.min(1, pct));
      const nextIdx = Math.round(clamped * (TYPE_LIST.length - 1));
      const next = TYPE_LIST[nextIdx];
      if (next !== valueRef.current) {
        valueRef.current = next;
        onChange(next);
      }
    };

    apply(e.clientX);

    const onMove = (ev: PointerEvent) => apply(ev.clientX);
    const onUp = () => {
      wrap.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const handleLeftPct = (idx / (TYPE_LIST.length - 1)) * 100;

  return (
    <div
      ref={wrapRef}
      onPointerDown={onPointerDown}
      className="relative h-8 cursor-pointer select-none touch-none"
    >
      {/* Track */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-neutral-200 dark:bg-neutral-800" />
      {/* Tick marks */}
      {TYPE_LIST.map((_, i) => {
        const left = (i / (TYPE_LIST.length - 1)) * 100;
        return (
          <div
            key={i}
            className="pointer-events-none absolute top-1/2 h-2 w-px -translate-y-1/2 bg-neutral-400 dark:bg-neutral-600"
            style={{ left: `${left}%` }}
          />
        );
      })}
      {/* Handle */}
      <div
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sky-500 bg-white shadow-sm dark:bg-neutral-100"
        style={{ left: `${handleLeftPct}%` }}
      />
    </div>
  );
}
