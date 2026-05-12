import {
  Download,
  FilePlus,
  FolderOpen,
  Pause,
  Play,
  Redo2,
  Save,
  SkipBack,
  Undo2,
} from "lucide-react";
import { useProjectStore, useProjectTemporal } from "../../store/projectStore";
import { usePlaybackStore } from "../../store/playbackStore";
import { generateReactComponent } from "../../export/generateComponent";
import { downloadFile } from "../../export/download";
import {
  openProjectFile,
  saveProjectFile,
} from "../../persistence/importExport";
import { clearStorage } from "../../persistence/localStorage";
import { UserMenu } from "./UserMenu";

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const resetToSample = useProjectStore((s) => s.resetToSample);
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

  const onExport = () => {
    const jsx = generateReactComponent(project);
    const safeName =
      project.name
        .trim()
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "Hero";
    downloadFile(`${safeName}.jsx`, jsx, "text/jsx");
  };

  const onSaveProject = () => saveProjectFile(project);

  const onLoadProject = async () => {
    const loaded = await openProjectFile();
    if (loaded) {
      setProject(loaded);
      setPlaying(false);
      setCurrentTime(0);
    }
  };

  const onResetToSample = () => {
    if (!window.confirm("Reset to the sample project? This discards your current work.")) {
      return;
    }
    clearStorage();
    resetToSample();
    setPlaying(false);
    setCurrentTime(0);
    useProjectTemporal.getState().clear();
  };

  const onUndo = () => useProjectTemporal.getState().undo();
  const onRedo = () => useProjectTemporal.getState().redo();

  return (
    <header className="flex items-center gap-4 border-b border-neutral-800 bg-neutral-950 px-4 py-2">
      <div className="flex items-baseline gap-3">
        <h1 className="text-sm font-semibold tracking-tight">reactimate</h1>
        <span className="text-xs text-neutral-500">Hero Animator</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          className="rounded p-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          className="rounded p-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 size={14} />
        </button>
      </div>

      <div className="h-5 w-px bg-neutral-800" />

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

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onResetToSample}
          className="rounded p-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          title="Reset to sample project"
          aria-label="Reset to sample"
        >
          <FilePlus size={14} />
        </button>
        <button
          type="button"
          onClick={onLoadProject}
          className="rounded p-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          title="Open a saved project (.json)"
          aria-label="Open project"
        >
          <FolderOpen size={14} />
        </button>
        <button
          type="button"
          onClick={onSaveProject}
          className="rounded p-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          title="Save project as .json"
          aria-label="Save project"
        >
          <Save size={14} />
        </button>
      </div>

      <button
        type="button"
        onClick={onExport}
        className="flex items-center gap-1.5 rounded border border-neutral-700 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:border-neutral-500 hover:text-white"
        title="Export Hero.jsx (Motion)"
      >
        <Download size={14} />
        Export
      </button>

      <div className="text-xs text-neutral-500">{project.name}</div>
      <UserMenu />
    </header>
  );
}
