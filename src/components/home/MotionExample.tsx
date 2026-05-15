import { useState, type ReactNode } from "react";
import { Check, Code2, Copy, Edit3, Eye, RotateCw } from "lucide-react";

interface MotionExampleProps {
  title: string;
  caption?: string;
  demo: ReactNode;
  code: string;
  replayKey: number;
  onReplay: () => void;
  background?: string;
  textColor?: string;
  onOpenInEditor?: () => void;
}

export function MotionExample({
  title,
  caption,
  demo,
  code,
  replayKey,
  onReplay,
  onOpenInEditor,
  background = "#0a0a0a",
  textColor = "#fafafa",
}: MotionExampleProps) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignored
    }
  };

  return (
    <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
          {caption && (
            <p className="truncate text-xs text-neutral-500">{caption}</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`flex items-center gap-1 rounded px-2 py-1 ${
              tab === "preview"
                ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
            }`}
            title="Live animation"
          >
            <Eye size={12} />
            Preview
          </button>
          <button
            type="button"
            onClick={() => setTab("code")}
            className={`flex items-center gap-1 rounded px-2 py-1 ${
              tab === "code"
                ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
            }`}
            title="Generated JSX"
          >
            <Code2 size={12} />
            Code
          </button>
          {onOpenInEditor && (
            <button
              type="button"
              onClick={onOpenInEditor}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/40"
              title="Open this example in the editor"
            >
              <Edit3 size={11} />
              Editor
            </button>
          )}
        </div>
      </header>

      {tab === "preview" ? (
        <div className="relative">
          <div
            key={replayKey}
            className="flex h-56 items-center justify-center px-6"
            style={{
              background,
              color: textColor,
              fontFamily: 'Inter, system-ui, "Segoe UI", Roboto, sans-serif',
            }}
          >
            <div className="text-center">{demo}</div>
          </div>
          <button
            type="button"
            onClick={onReplay}
            title="Replay animation"
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium text-white backdrop-blur hover:bg-black/60"
          >
            <RotateCw size={11} />
            Replay
          </button>
        </div>
      ) : (
        <div className="relative">
          <pre className="m-0 max-h-56 overflow-auto bg-neutral-50 px-3 py-3 text-[11px] leading-relaxed text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
            <code className="font-mono">{code}</code>
          </pre>
          <button
            type="button"
            onClick={onCopy}
            className="absolute right-3 top-2 inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            title="Copy to clipboard"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </article>
  );
}
