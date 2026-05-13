import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Github } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-neutral-200 dark:border-neutral-800">
      <div className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_15%_20%,_rgba(56,189,248,0.15),_transparent_45%),radial-gradient(circle_at_85%_30%,_rgba(244,114,182,0.12),_transparent_50%),radial-gradient(circle_at_50%_85%,_rgba(132,204,22,0.10),_transparent_55%)]" />

      <div className="mx-auto max-w-5xl px-6 py-20 text-center sm:py-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/60 px-3 py-1 text-xs text-neutral-600 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Open-source · MIT licensed
        </div>

        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Design{" "}
          <motion.span
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >
            animated
          </motion.span>{" "}
          <motion.span
            initial={{ opacity: 0, x: -24, color: "#a3a3a3" }}
            animate={{ opacity: 1, x: 0, color: "#0ea5e9" }}
            transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >
            hero
          </motion.span>{" "}
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >
            text
          </motion.span>
          <br className="hidden sm:block" />
          <span className="text-neutral-500">export clean React + Motion.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-neutral-600 sm:text-lg dark:text-neutral-400">
          A visual editor for the title of your landing page. Type some text, turn words into components,
          pile on fades / slides / spotlights / sparkles / typewriter — then download a self-contained
          <code className="mx-1 rounded bg-neutral-100 px-1 py-0.5 text-sm dark:bg-neutral-800">Hero.jsx</code>
          you can drop into any React project.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Open the editor
            <ArrowRight size={14} />
          </Link>
          <a
            href="https://github.com/shawnkowalchuk/reactimate"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-500"
          >
            <Github size={14} />
            View on GitHub
          </a>
        </div>

        <p className="mt-6 text-xs text-neutral-500">No backend required · works offline · localStorage autosave</p>
      </div>
    </section>
  );
}
