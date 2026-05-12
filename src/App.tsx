import type { ReactNode } from "react";
import { useState } from "react";
import { useProjectStore } from "./store/projectStore";
import { useAnimationEngine } from "./playback/useAnimationEngine";
import { useKeyboardShortcuts } from "./playback/useKeyboardShortcuts";
import { useAutosave } from "./persistence/useAutosave";
import { Toolbar } from "./components/layout/Toolbar";
import { PreviewCanvas } from "./components/preview/PreviewCanvas";
import { CodeView } from "./components/preview/CodeView";
import { Timeline } from "./components/timeline/Timeline";

type PreviewTab = "preview" | "code";

export function App() {
  const project = useProjectStore((s) => s.project);
  const { registerElement } = useAnimationEngine();
  useKeyboardShortcuts();
  useAutosave();

  const [previewTab, setPreviewTab] = useState<PreviewTab>("preview");

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
          <div className="mb-2 flex items-center gap-1">
            <TabButton
              active={previewTab === "preview"}
              onClick={() => setPreviewTab("preview")}
            >
              Preview
            </TabButton>
            <TabButton
              active={previewTab === "code"}
              onClick={() => setPreviewTab("code")}
            >
              Code
            </TabButton>
          </div>
          <div className="flex-1 min-h-0">
            {/* Keep PreviewCanvas mounted so the animation engine refs stay registered. */}
            <div className={previewTab === "preview" ? "h-full" : "hidden"}>
              <PreviewCanvas project={project} registerElement={registerElement} />
            </div>
            {previewTab === "code" && (
              <div className="h-full">
                <CodeView project={project} />
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-800 bg-neutral-950">
        <Timeline />
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-xs font-medium tracking-wider uppercase ${
        active
          ? "bg-neutral-800 text-neutral-100"
          : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}
