import {
  Code2,
  FileJson2,
  KeyRound,
  Layers,
  Palette,
  Repeat,
  Save,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: Layers,
    title: "Visual + code, side-by-side",
    body: "Live Preview tab and Code tab in the same pane. Drag on the timeline, watch the JSX update in real time.",
  },
  {
    icon: Sparkles,
    title: "Effects that go beyond fades",
    body: "Spotlight (mouse / sweep), sparkle particles (fireworks, volcano, dropping), per-letter typewriter, plus the basics.",
  },
  {
    icon: Palette,
    title: "Per-component style",
    body: "Each componentized word gets its own font (26 curated Google fonts), weight, size, color, alignment.",
  },
  {
    icon: Code2,
    title: "Clean exported JSX",
    body: "Output uses motion/react and reads like code a human would write — consolidated transitions, idiomatic ease names.",
  },
  {
    icon: Save,
    title: "Local autosave + JSON",
    body: "Projects autosave to localStorage; export and re-import as plain JSON. Effect presets save/load/import/export too.",
  },
  {
    icon: Repeat,
    title: "Undo / redo and loop play",
    body: "Cmd+Z any change. Loop the preview continuously while you tweak. Spacebar to play/pause.",
  },
  {
    icon: KeyRound,
    title: "Optional Supabase auth",
    body: "Drop in two env vars and the editor gates behind email/password, magic link, Google, or Apple sign-in.",
  },
  {
    icon: FileJson2,
    title: "Self-contained output",
    body: "Hero.jsx ships with one import (motion/react) and zero hidden runtime — no provider, no global CSS.",
  },
];

export function Features() {
  return (
    <section className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/30">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for shipping
          </h2>
          <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
            Everything you need to turn a hero animation idea into committed code.
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
            >
              <f.icon className="text-sky-500" size={18} />
              <h3 className="mt-3 text-sm font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                {f.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
