import { Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-white dark:bg-neutral-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-neutral-500 sm:flex-row">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold tracking-tight text-neutral-700 dark:text-neutral-300">
            reactimate
          </span>
          <span className="text-xs">· Hero Animator</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/shawnkowalchuk/reactimate"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            <Github size={14} />
            GitHub
          </a>
          <a
            href="https://github.com/shawnkowalchuk/reactimate/blob/main/STATUS.md"
            target="_blank"
            rel="noreferrer"
            className="hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            Status
          </a>
          <a
            href="https://github.com/shawnkowalchuk/reactimate/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            MIT
          </a>
        </div>
      </div>
    </footer>
  );
}
