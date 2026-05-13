import { useRef } from "react";
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

  // Absolute scrub: the playhead snaps to wherever the mouse is.
  // Captured at drag-start: the timeline track's left edge in viewport
  // coords, so we can convert clientX -> time directly during onMove.
  const trackLeftRef = useRef<number>(0);

  const onPointerDown = useDragGesture({
    onStart: (e) => {
      setPlaying(false);
      // The playhead handle is wrapped in an `absolute` div whose parent
      // is the timeline-tracks container (`position: relative`). Walk
      // up two levels to read that container's viewport-x origin.
      const handle = e.currentTarget as HTMLElement;
      const track = handle.parentElement?.parentElement;
      trackLeftRef.current = track?.getBoundingClientRect().left ?? 0;
      // Snap the playhead to the initial click position so the very
      // first frame of the drag also tracks the cursor.
      const t = clamp(
        (e.clientX - trackLeftRef.current) / Math.max(0.0001, pxPerSecond),
        0,
        duration,
      );
      setCurrentTime(t);
    },
    onMove: (_dx, _dy, ev) => {
      const t = clamp(
        (ev.clientX - trackLeftRef.current) / Math.max(0.0001, pxPerSecond),
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
