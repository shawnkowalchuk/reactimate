import { Link } from "react-router-dom";
import { ArrowRight, Github } from "lucide-react";

export function CallToAction() {
  return (
    <section className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Ready to animate your hero?
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base text-neutral-600 dark:text-neutral-400">
          Open-source and free. Sign up to use the hosted editor — your
          projects sync across devices. Or clone the repo to run it locally.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Sign up & open the editor
            <ArrowRight size={14} />
          </Link>
          <a
            href="https://github.com/shawnkowalchuk/reactimate"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-500"
          >
            <Github size={14} />
            Clone & run locally
          </a>
        </div>
      </div>
    </section>
  );
}
