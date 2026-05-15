import { ChevronDown } from "lucide-react";

interface QA {
  q: string;
  a: React.ReactNode;
}

const ITEMS: QA[] = [
  {
    q: "What's the license? Can I use this commercially?",
    a: (
      <>
        MIT. The editor, the schema, and the exported{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">Hero.jsx</code>{" "}
        are all yours to use, modify, and ship in commercial projects with no royalty.
      </>
    ),
  },
  {
    q: "How do I add the exported component to my website?",
    a: (
      <>
        Open the editor, click <strong>Export</strong>, drop the downloaded{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">Hero.jsx</code>{" "}
        into your React project's source tree, run{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">npm install motion fireworks-js</code>
        , then import and render{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">&lt;Hero /&gt;</code>{" "}
        wherever you want your animated headline. See the four steps above for the full walkthrough.
      </>
    ),
  },
  {
    q: "Which frameworks does the exported code work in?",
    a: (
      <>
        Any project using React 18 or 19 — that includes Next.js (both App Router and Pages), Vite, Remix, Create React App, Astro (inside React islands), Gatsby, RedwoodJS, and more. The exported file is plain JSX with a single import from <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">motion/react</code> — no globals, no provider, no build-time setup.
      </>
    ),
  },
  {
    q: "What dependencies does the exported code have?",
    a: (
      <>
        Exactly one: <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">motion</code> (the package formerly known as <em>framer-motion</em>). It's ~30 KB gzipped and tree-shakable. Your component imports{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">motion/react</code> so only the React-flavored parts are pulled in.
      </>
    ),
  },
  {
    q: "Can I customize the animation after exporting?",
    a: (
      <>
        Yes — the output is plain JSX that reads like code you'd write by hand. Tweak the{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">transition</code> objects, change values in{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">animate</code>, swap colors, refactor — it's your file, no hidden magic. If you change the source text inside the editor and re-export, you'll get a fresh file you can diff and merge.
      </>
    ),
  },
  {
    q: "Why JSX instead of Lottie / MP4?",
    a: (
      <>
        Because hero text is text. JSX keeps it selectable, indexable by Google, accessible to screen readers, and trivially restylable with the rest of your page (CSS variables, dark mode, fluid sizing). Lottie/MP4 export is on the backlog for cases where you really do want a flat artifact.
      </>
    ),
  },
  {
    q: "Do my projects get uploaded anywhere?",
    a: (
      <>
        Not by default. The editor autosaves your project to your browser's{" "}
        <code className="rounded bg-neutral-100 px-1 text-[0.85em] dark:bg-neutral-800">localStorage</code>{" "}
        and nothing leaves your machine. If you turn on the optional Supabase integration, your <em>effect presets</em> follow you across devices. Per-user project sync is on the roadmap.
      </>
    ),
  },
  {
    q: "Does it work offline?",
    a: (
      <>
        Yes. After the first page load, everything (editor, preview, animation engine, export) runs entirely in your browser. The marketing site, sign-in, and feedback features need a network connection.
      </>
    ),
  },
  {
    q: "How do I report a bug or request a feature?",
    a: (
      <>
        Either way works:
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            <a
              href="https://github.com/shawnkowalchuk/reactimate/issues"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              Open a GitHub issue
            </a>{" "}
            (public; good for bugs with reproducible steps).
          </li>
          <li>
            Or send a private note via the{" "}
            <a href="/feedback" className="underline hover:text-neutral-700 dark:hover:text-neutral-200">
              Feedback page
            </a>{" "}
            (signed-in users get admin replies in-app).
          </li>
        </ul>
      </>
    ),
  },
];

export function FAQ() {
  return (
    <section
      id="faq"
      className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/30"
    >
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            FAQ
          </h2>
          <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
            Quick answers to the questions that come up most often.
          </p>
        </div>

        <div className="mt-12 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white shadow-sm dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          {ITEMS.map((item, i) => (
            <details
              key={i}
              className="group px-5 py-4"
              // First item is open by default so the section reads as
              // populated even before the user clicks anything.
              open={i === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
                <span>{item.q}</span>
                <ChevronDown
                  size={16}
                  className="shrink-0 text-neutral-500 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
