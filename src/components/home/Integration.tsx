import { Code2, Download, FolderInput, Package } from "lucide-react";

const STEPS = [
  {
    icon: Download,
    title: "Export from the editor",
    body: (
      <>
        Click <strong>Export</strong> in the toolbar. You'll get a single{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">
          Hero.tsx
        </code>{" "}
        file — no zip, no extras.
      </>
    ),
  },
  {
    icon: Package,
    title: "Install dependencies",
    body: (
      <>
        Inside your React project:{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">
          npm install motion fireworks-js
        </code>
        . These are the only dependencies the exported component needs.
      </>
    ),
  },
  {
    icon: FolderInput,
    title: "Drop in the file",
    body: (
      <>
        Move <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">Hero.tsx</code>{" "}
        anywhere in your source tree (e.g.{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">
          src/components/Hero.tsx
        </code>
        ).
      </>
    ),
  },
  {
    icon: Code2,
    title: "Import and render",
    body: (
      <>
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">
          import &#123; Hero &#125; from "./components/Hero";
        </code>{" "}
        — then drop{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">
          &lt;Hero /&gt;
        </code>{" "}
        wherever you want it. No provider, no global CSS, no setup.
      </>
    ),
  },
];

const SNIPPET = `// src/app/page.tsx (or wherever your hero lives)
import { Hero } from "./components/Hero";

export default function Page() {
  return (
    <main>
      <Hero />
      {/* …the rest of your landing page… */}
    </main>
  );
}`;

export function Integration() {
  return (
    <section
      id="integration"
      className="border-b border-neutral-200 dark:border-neutral-800"
    >
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Add it to your site in four steps
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-neutral-600 dark:text-neutral-400">
            Works in any React app — Next.js, Vite, Remix, CRA, Astro
            islands. The exported file is plain JSX with a single import.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="relative rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="absolute -top-3 left-6 grid h-6 w-6 place-items-center rounded-full bg-neutral-900 text-[11px] font-medium text-white dark:bg-white dark:text-neutral-900">
                {i + 1}
              </div>
              <s.icon className="text-sky-500" size={22} />
              <h3 className="mt-4 text-base font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {s.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-10 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-[11px] uppercase tracking-wider text-neutral-500 dark:border-neutral-800">
            <span>Usage in your page</span>
            <span className="font-mono text-[10px] normal-case tracking-normal">
              page.tsx
            </span>
          </div>
          <pre className="m-0 overflow-auto px-4 py-3 text-[12px] leading-relaxed text-neutral-800 dark:text-neutral-200">
            <code className="font-mono">{SNIPPET}</code>
          </pre>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Need help? See the{" "}
          <a
            href="https://github.com/shawnkowalchuk/reactimate#using-an-exported-herojsx-in-your-own-project"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            full integration guide
          </a>{" "}
          on GitHub.
        </p>
      </div>
    </section>
  );
}
