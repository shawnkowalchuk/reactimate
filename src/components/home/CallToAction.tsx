import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function CallToAction() {
  return (
    <section className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Ready to animate your hero?
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base text-neutral-600 dark:text-neutral-400">
          The editor loads instantly and runs entirely in your browser. No account required.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Open the editor
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
