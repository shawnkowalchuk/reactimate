import { Download, MousePointerSquareDashed, Sparkles, Type } from "lucide-react";

const STEPS = [
  {
    icon: Type,
    title: "Type",
    body: "Drop your hero text into the canvas-shaped editor. It looks exactly like the live preview.",
  },
  {
    icon: MousePointerSquareDashed,
    title: "Componentize",
    body: "Select words or phrases and turn them into colored components. Each gets its own style and effects.",
  },
  {
    icon: Sparkles,
    title: "Animate",
    body: "Fade, slide, scale, rotate, color-shift, spotlight, particle, typewriter. Drag blocks on the timeline. Scrub and play.",
  },
  {
    icon: Download,
    title: "Export",
    body: "Click Export — download a self-contained Hero.jsx using motion/react. Drop it into your project.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/30">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
            Four steps to a publish-ready animated hero.
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
              <h3 className="mt-4 text-base font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
