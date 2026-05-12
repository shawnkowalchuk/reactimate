import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Project } from "../../types/project";
import { generateReactComponent } from "../../export/generateComponent";

interface CodeViewProps {
  project: Project;
}

export function CodeView({ project }: CodeViewProps) {
  const code = useMemo(() => generateReactComponent(project), [project]);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard API failed (e.g. blocked) — fall back to selecting the pre
      const pre = document.getElementById("code-view-pre");
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded bg-neutral-50 dark:bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-1.5 dark:border-neutral-800">
        <span className="text-[11px] tabular-nums text-neutral-500">
          Hero.jsx · {code.split("\n").length} lines · {(code.length / 1024).toFixed(2)} KB
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1.5 rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-700 hover:border-neutral-500 hover:text-neutral-950 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:text-white"
          title="Copy to clipboard"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        id="code-view-pre"
        className="m-0 flex-1 overflow-auto px-3 py-3 text-[12px] leading-relaxed text-neutral-800 dark:text-neutral-200"
      >
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
