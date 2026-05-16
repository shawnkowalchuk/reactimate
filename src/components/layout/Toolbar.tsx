import {
  Download,
  FilePlus,
  FolderOpen,
  Moon,
  Pause,
  Play,
  Redo2,
  Repeat,
  Save,
  SkipBack,
  Sun,
  Undo2,
} from "lucide-react";
import { useProjectStore, useProjectTemporal } from "../../store/projectStore";
import { usePlaybackStore } from "../../store/playbackStore";
import { useThemeStore } from "../../store/themeStore";
import { generateReactComponent } from "../../export/generateComponent";
import { downloadFile } from "../../export/download";
import {
  openProjectFile,
  saveProjectFile,
} from "../../persistence/importExport";
import { clearStorage } from "../../persistence/localStorage";
import { Link } from "react-router-dom";
import { UserMenu } from "./UserMenu";

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const resetToSample = useProjectStore((s) => s.resetToSample);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const loop = usePlaybackStore((s) => s.loop);
  const togglePlaying = usePlaybackStore((s) => s.togglePlaying);
  const toggleLoop = usePlaybackStore((s) => s.toggleLoop);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

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
    // Always export as Hero.tsx so the file you download is the exact name
    // referenced in the Test-Project's App.tsx and in the docs (`import
    // { Hero } from "./Hero"`). The exported function itself is always
    // named `Hero` regardless of project name; the file should match.
    // .tsx is a strict superset of .jsx for typeless code — works in
    // plain JS/JSX projects and in TypeScript projects alike.
    downloadFile("Hero.tsx", jsx, "text/typescript");
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

  const iconBtn =
    "rounded p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white";
  const iconBtnActive =
    "rounded p-1.5 text-sky-600 bg-sky-100 hover:bg-sky-200 dark:text-sky-300 dark:bg-sky-900/40 dark:hover:bg-sky-900/60";

  return (
    <header className="flex items-center gap-4 border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-950">
      <Link to="/" className="flex items-baseline gap-3 hover:opacity-70 transition-opacity" title="Back to home page">
        <h1 className="text-sm font-semibold tracking-tight">reactimate</h1>
        <span className="text-xs text-neutral-500">Hero Animator</span>
      </Link>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          className={iconBtn}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          className={iconBtn}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 size={14} />
        </button>
      </div>

      <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-800" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onReset}
          className={iconBtn}
          title="Back to start (Home)"
          aria-label="Back to start"
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          onClick={onPlay}
          className="flex items-center gap-1.5 rounded bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          title="Play / pause (Space)"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={toggleLoop}
          className={loop ? iconBtnActive : iconBtn}
          title={loop ? "Loop: on" : "Loop: off"}
          aria-label="Toggle loop"
          aria-pressed={loop}
        >
          <Repeat size={14} />
        </button>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <span className="tabular-nums text-xs text-neutral-500">
          {currentTime.toFixed(2)}s
        </span>
        <input
          type="range"
          min={0}
          max={project.duration}
          step={0.01}
          value={Math.min(currentTime, project.duration)}
          onChange={onScrub}
          className="flex-1 accent-neutral-400 dark:accent-neutral-400"
          aria-label="Scrub time"
        />
        <span className="tabular-nums text-xs text-neutral-500">
          {project.duration.toFixed(2)}s
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleTheme}
          className={iconBtn}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-800" />
        <button
          type="button"
          onClick={onResetToSample}
          className={iconBtn}
          title="Reset to sample project"
          aria-label="Reset to sample"
        >
          <FilePlus size={14} />
        </button>
        <button
          type="button"
          onClick={onLoadProject}
          className={iconBtn}
          title="Open a saved project (.json)"
          aria-label="Open project"
        >
          <FolderOpen size={14} />
        </button>
        <button
          type="button"
          onClick={onSaveProject}
          className={iconBtn}
          title="Save project as .json"
          aria-label="Save project"
        >
          <Save size={14} />
        </button>
      </div>

      <button
        type="button"
        onClick={onExport}
        className="flex items-center gap-1.5 rounded border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:border-neutral-500 hover:text-neutral-950 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:text-white"
        title="Export Hero.tsx (Motion)"
      >
        <Download size={14} />
        Export
      </button>

      <div className="text-xs text-neutral-500">{project.name}</div>
      <UserMenu />
    </header>
  );
}
