import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, MousePointer2 } from "lucide-react";
import type { Project } from "../../types/project";
import { generateReactComponent } from "../../export/generateComponent";

interface CodeViewProps {
  project: Project;
}

export function CodeView({ project }: CodeViewProps) {
  const code = useMemo(() => generateReactComponent(project), [project]);
  const [editCode, setEditCode] = useState(code);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when the project changes.
  useEffect(() => {
    setEditCode(code);
  }, [code]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(editCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      const ta = textareaRef.current;
      if (ta) {
        ta.select();
      }
    }
  };

  const onSelectAll = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.select();
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded bg-neutral-50 dark:bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-1.5 dark:border-neutral-800">
        <span className="text-[11px] tabular-nums text-neutral-500">
          Hero.jsx · {code.split("\n").length} lines · {(code.length / 1024).toFixed(2)} KB
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSelectAll}
            className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-200"
            title="Select all code"
          >
            <MousePointer2 size={12} />
            All
          </button>
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
      </div>
      <textarea
        ref={textareaRef}
        className="m-0 flex-1 resize-none overflow-auto border-0 bg-transparent px-3 py-3 font-mono text-[12px] leading-relaxed text-neutral-800 outline-none dark:text-neutral-200"
        value={editCode}
        readOnly={false}
        spellCheck={false}
        onChange={(e) => setEditCode(e.target.value)}
      />
    </div>
  );
}
