import { useMemo } from "react";
import { tickStepFor } from "./timelineMath";

interface TimelineRulerProps {
  duration: number;
  pxPerSecond: number;
  onSeek: (time: number) => void;
}

export function TimelineRuler({ duration, pxPerSecond, onSeek }: TimelineRulerProps) {
  const ticks = useMemo(() => {
    const step = tickStepFor(duration);
    const out: number[] = [];
    for (let t = 0; t <= duration + 1e-9; t += step) {
      out.push(+t.toFixed(6));
    }
    return out;
  }, [duration]);

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = pxPerSecond > 0 ? x / pxPerSecond : 0;
    onSeek(Math.max(0, Math.min(duration, t)));
  };

  return (
    <div
      className="relative h-6 cursor-pointer select-none border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
      onClick={onClick}
      role="presentation"
    >
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-0 h-full"
          style={{ left: t * pxPerSecond }}
        >
          <div className="absolute left-0 top-0 h-2 w-px bg-neutral-300 dark:bg-neutral-700" />
          <span className="absolute left-1 top-1 text-[10px] tabular-nums text-neutral-500">
            {t.toFixed(t % 1 === 0 ? 0 : 2)}s
          </span>
        </div>
      ))}
    </div>
  );
}
