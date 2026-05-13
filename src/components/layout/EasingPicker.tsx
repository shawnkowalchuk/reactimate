import { useMemo } from "react";
import { easings } from "../../engine/easing";
import type { EasingType } from "../../types/project";

const EASING_LIST: EasingType[] = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "spring",
  "bounce",
];

const W = 60;
const H = 36;
const PAD = 4;

interface Props {
  value: EasingType;
  onChange: (next: EasingType) => void;
}

/**
 * Visual easing picker — a 3×2 grid of mini SVG curve previews. Each
 * cell shows the easing function from t=0..1 with the y-axis flipped
 * (down = 0, up = 1, like a typical easing graph).
 */
export function EasingPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {EASING_LIST.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          title={e}
          aria-pressed={e === value}
          className={`flex flex-col items-center gap-0.5 rounded border p-1.5 text-[10px] transition-colors ${
            e === value
              ? "border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-500/60 dark:bg-sky-900/30 dark:text-sky-100"
              : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-500"
          }`}
        >
          <EasingGraph easing={e} active={e === value} />
          <span className="font-mono">{e}</span>
        </button>
      ))}
    </div>
  );
}

function EasingGraph({ easing, active }: { easing: EasingType; active: boolean }) {
  const path = useMemo(() => buildPath(easing), [easing]);
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="overflow-visible"
    >
      {/* Baseline + ceiling guides */}
      <line
        x1={PAD}
        x2={W - PAD}
        y1={H - PAD}
        y2={H - PAD}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={0.5}
      />
      <line
        x1={PAD}
        x2={W - PAD}
        y1={PAD}
        y2={PAD}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={0.5}
      />
      <path
        d={path}
        fill="none"
        stroke={active ? "rgb(56, 189, 248)" : "currentColor"}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildPath(easing: EasingType): string {
  const fn = easings[easing];
  const samples = 32;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  let d = "";
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const y = fn(t);
    // Spring/bounce can briefly exceed [0, 1]; clamp visually.
    const clamped = Math.max(-0.2, Math.min(1.2, y));
    const px = PAD + t * innerW;
    const py = PAD + (1 - clamped) * innerH;
    d += (i === 0 ? "M" : "L") + px.toFixed(2) + " " + py.toFixed(2) + " ";
  }
  return d.trim();
}
