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
      <header className="flex flex-col gap-1 border-b border-neutral-200 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0 dark:border-neutral-800">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
          {caption && (
            <p className="truncate text-xs text-neutral-500">{caption}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`flex min-h-[40px] items-center gap-1 rounded px-2 py-1 sm:min-h-0 ${
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
            className={`flex min-h-[40px] items-center gap-1 rounded px-2 py-1 sm:min-h-0 ${
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
              // Bordered/filled so "Editor" reads as the card's action rather
              // than a third tab alongside Preview/Code. The left margin only
              // applies from sm: up — on a phone the row already wraps, and the
              // extra gap would just cost width the card doesn't have.
              className="inline-flex min-h-[40px] items-center gap-1 rounded border border-sky-300 bg-sky-50 px-2 py-1 text-sky-700 hover:bg-sky-100 sm:ml-2 sm:min-h-0 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/60"
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
            className="flex h-56 items-center justify-center px-4 sm:px-6"
            style={{
              background,
              color: textColor,
              fontFamily: 'Inter, system-ui, "Segoe UI", Roboto, sans-serif',
            }}
          >
            <div className="min-w-0 text-center">{demo}</div>
          </div>
          <button
            type="button"
            onClick={onReplay}
            title="Replay animation"
            className="absolute right-3 top-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium text-white backdrop-blur hover:bg-black/60 sm:min-h-0"
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
            className="absolute right-3 top-2 inline-flex min-h-[40px] items-center gap-1.5 rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:border-neutral-500 sm:min-h-0 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
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
