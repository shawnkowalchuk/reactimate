import { useProjectStore } from "./store/projectStore";
import { useAnimationEngine } from "./playback/useAnimationEngine";
import { useKeyboardShortcuts } from "./playback/useKeyboardShortcuts";
import { Toolbar } from "./components/layout/Toolbar";
import { PreviewCanvas } from "./components/preview/PreviewCanvas";

export function App() {
  const project = useProjectStore((s) => s.project);
  const { registerElement } = useAnimationEngine();
  useKeyboardShortcuts();

  return (
    <div className="grid h-screen grid-rows-[auto_minmax(0,1fr)_auto] bg-neutral-950 text-neutral-100">
      <Toolbar />

      <main className="grid min-h-0 grid-cols-2 gap-px bg-neutral-800">
        <section className="flex min-h-0 flex-col bg-neutral-950 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
            Editor
          </h2>
          <div className="flex-1 overflow-auto rounded border border-dashed border-neutral-800 p-4">
            <p className="text-xs text-neutral-500">
              Phase 3 will replace this with a contenteditable + overlay. For
              now:
            </p>
            <p className="mt-2 break-words font-mono text-lg">
              "{project.layer.text}"
            </p>
            <ul className="mt-3 space-y-1 text-xs text-neutral-400">
              {project.layer.components.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: c.color }}
                  />
                  <code className="text-neutral-300">
                    [{c.startIndex}, {c.endIndex})
                  </code>
                  <span>"{project.layer.text.slice(c.startIndex, c.endIndex)}"</span>
                  <span className="text-neutral-500">
                    · {c.effects.length} effect{c.effects.length === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex min-h-0 flex-col bg-neutral-950 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
            Preview
          </h2>
          <div className="flex-1 min-h-0">
            <PreviewCanvas project={project} registerElement={registerElement} />
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-800 bg-neutral-950 p-4">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
          Timeline
        </h2>
        <div className="rounded border border-dashed border-neutral-800 p-4 text-xs text-neutral-500">
          Phase 7 — timeline rows + draggable effect blocks. (Use the toolbar
          scrubber and Play to see the animation now.)
        </div>
      </footer>
    </div>
  );
}
