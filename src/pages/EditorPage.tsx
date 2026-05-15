import type { ReactNode } from "react";
import { useState } from "react";
import { useProjectStore } from "../store/projectStore";
import { useAnimationEngine } from "../playback/useAnimationEngine";
import { useKeyboardShortcuts } from "../playback/useKeyboardShortcuts";
import { useAutosave } from "../persistence/useAutosave";
import { useCloudSync } from "../persistence/useCloudSync";
import { Toolbar } from "../components/layout/Toolbar";
import { InspectorBar } from "../components/layout/InspectorBar";
import { TextEditor } from "../components/editor/TextEditor";
import { PreviewCanvas } from "../components/preview/PreviewCanvas";
import { CodeView } from "../components/preview/CodeView";
import { Timeline } from "../components/timeline/Timeline";

type PreviewTab = "preview" | "code";

export function EditorPage() {
  const project = useProjectStore((s) => s.project);
  const { registerElement } = useAnimationEngine();
  useKeyboardShortcuts();
  useAutosave();
  useCloudSync();

  const [previewTab, setPreviewTab] = useState<PreviewTab>("preview");

  return (
    <div className="grid h-screen grid-rows-[auto_auto_minmax(0,1fr)_2fr] bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Toolbar />
      <InspectorBar />

      <main className="grid min-h-0 grid-cols-2 gap-px bg-neutral-200 dark:bg-neutral-800">
        <section className="flex min-h-0 flex-col bg-white p-4 dark:bg-neutral-950">
          <TextEditor />
        </section>

        <section className="flex min-h-0 flex-col bg-white p-4 dark:bg-neutral-950">
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
            <div className={previewTab === "preview" ? "h-full" : "hidden"}>
              <PreviewCanvas project={project} registerElement={registerElement} />
            </div>
            <div className={previewTab === "code" ? "h-full" : "hidden"}>
              <CodeView project={project} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
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
          ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}
