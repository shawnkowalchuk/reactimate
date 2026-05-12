import { Pause, Play, SkipBack } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { usePlaybackStore } from "../../store/playbackStore";

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const togglePlaying = usePlaybackStore((s) => s.togglePlaying);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);

  const onPlay = () => {
    if (!isPlaying && currentTime >= project.duration) {
      setCurrentTime(0);
    }
    togglePlaying();
  };

  const onReset = () => {
    setPlaying(false);
    setCurrentTime(0);
  };

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaying(false);
    setCurrentTime(parseFloat(e.target.value));
  };

  return (
    <header className="flex items-center gap-4 border-b border-neutral-800 bg-neutral-950 px-4 py-2">
      <div className="flex items-baseline gap-3">
        <h1 className="text-sm font-semibold tracking-tight">reactimate</h1>
        <span className="text-xs text-neutral-500">Hero Animator</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onReset}
          className="rounded p-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          title="Back to start (Home)"
          aria-label="Back to start"
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          onClick={onPlay}
          className="flex items-center gap-1.5 rounded bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
          title="Play / pause (Space)"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <span className="tabular-nums text-xs text-neutral-400">
          {currentTime.toFixed(2)}s
        </span>
        <input
          type="range"
          min={0}
          max={project.duration}
          step={0.01}
          value={Math.min(currentTime, project.duration)}
          onChange={onScrub}
          className="flex-1 accent-neutral-400"
          aria-label="Scrub time"
        />
        <span className="tabular-nums text-xs text-neutral-500">
          {project.duration.toFixed(2)}s
        </span>
      </div>

      <div className="text-xs text-neutral-500">{project.name}</div>
    </header>
  );
}
