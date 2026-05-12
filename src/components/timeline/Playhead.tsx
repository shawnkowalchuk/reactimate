import { useDragGesture } from "../../utils/dragGesture";
import { usePlaybackStore } from "../../store/playbackStore";
import { clamp } from "./timelineMath";

interface PlayheadProps {
  currentTime: number;
  duration: number;
  pxPerSecond: number;
}

export function Playhead({ currentTime, duration, pxPerSecond }: PlayheadProps) {
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);

  const onPointerDown = useDragGesture({
    onStart: () => {
      setPlaying(false);
    },
    onMove: (dx) => {
      const startTime = usePlaybackStore.getState().currentTime;
      const t = clamp(
        startTime + dx / Math.max(0.0001, pxPerSecond),
        0,
        duration,
      );
      setCurrentTime(t);
    },
  });

  const x = Math.max(0, currentTime * pxPerSecond);

  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-20"
      style={{ left: x, width: 0 }}
    >
      <div
        onPointerDown={onPointerDown}
        className="pointer-events-auto absolute -left-1.5 top-0 z-20 h-3 w-3 cursor-ew-resize rounded-sm bg-sky-400 shadow"
        title={`${currentTime.toFixed(2)}s`}
      />
      <div className="absolute inset-y-0 left-0 w-px bg-sky-400/70" />
    </div>
  );
}
