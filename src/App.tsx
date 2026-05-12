import { useProjectStore } from "./store/projectStore";
import { usePlaybackStore } from "./store/playbackStore";

export function App() {
  const project = useProjectStore((s) => s.project);
  const currentTime = usePlaybackStore((s) => s.currentTime);

  return (
    <div className="grid h-screen grid-rows-[auto_minmax(0,1fr)_auto] bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold tracking-tight">reactimate</h1>
          <span className="text-xs text-neutral-500">Hero Animator · Phase 1</span>
        </div>
        <div className="text-xs text-neutral-500">
          {project.name} · {project.duration.toFixed(2)}s · t={currentTime.toFixed(2)}
        </div>
      </header>

      <main className="grid min-h-0 grid-cols-2 gap-px bg-neutral-800">
        <section className="flex min-h-0 flex-col bg-neutral-950 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
            Editor
          </h2>
          <div className="flex-1 rounded border border-dashed border-neutral-800 p-4">
            <p className="text-xs text-neutral-500">
              Phase 3 — text editor with overlay. For now, the layer text is:
            </p>
            <p className="mt-2 text-lg">"{project.layer.text}"</p>
            <ul className="mt-3 text-xs text-neutral-400">
              {project.layer.components.map((c) => (
                <li key={c.id}>
                  <span
                    className="inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: c.color }}
                  />{" "}
                  <code className="text-neutral-300">
                    [{c.startIndex}, {c.endIndex})
                  </code>{" "}
                  "{project.layer.text.slice(c.startIndex, c.endIndex)}" —{" "}
                  {c.effects.length} effect{c.effects.length === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex min-h-0 flex-col bg-neutral-950 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
            Preview
          </h2>
          <div className="flex-1 rounded border border-dashed border-neutral-800 p-4">
            <p className="text-xs text-neutral-500">
              Phase 5 — canvas preview. Canvas:{" "}
              {project.canvas.width}×{project.canvas.height} ({project.canvas.preset})
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-800 bg-neutral-950 p-4">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
          Timeline
        </h2>
        <div className="rounded border border-dashed border-neutral-800 p-4 text-xs text-neutral-500">
          Phase 7 — timeline rows + draggable effect blocks.
        </div>
      </footer>
    </div>
  );
}
