import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MotionExample } from "./MotionExample";

/**
 * Each example renders a real `motion/react` animation — the same
 * shape the reactimate exporter would produce — so this section
 * doubles as a "what you'll get" gallery.
 *
 * Animations loop on a single shared timer so they stay in sync and
 * the user always sees them mid-flight on first paint. The Replay
 * button forces a re-mount for a clean restart.
 */
export function Examples() {
  // Bumped every 5s to remount and replay all examples.
  const [loopTick, setLoopTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setLoopTick((n) => n + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const [bumps, setBumps] = useState<number[]>([0, 0, 0]);
  const bump = (i: number) =>
    setBumps((arr) => arr.map((v, j) => (j === i ? v + 1 : v)));

  const replayKeyFor = (i: number) => loopTick * 1000 + bumps[i];

  return (
    <section
      id="examples"
      className="border-b border-neutral-200 dark:border-neutral-800"
    >
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Examples
          </h2>
          <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
            Built with reactimate. The code below is exactly what you get when you click Export.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <MotionExample
            title="Welcome — stagger fade"
            caption="Per-letter fade with reverse stagger"
            replayKey={replayKeyFor(0)}
            onReplay={() => bump(0)}
            background="#0a0a0a"
            textColor="#fafafa"
            demo={<StaggerHero />}
            code={STAGGER_CODE}
          />
          <MotionExample
            title="Slide + color shift"
            caption="Multi-prop transition with consolidated timing"
            replayKey={replayKeyFor(1)}
            onReplay={() => bump(1)}
            background="#ffffff"
            textColor="#0a0a0a"
            demo={<SlideShiftHero />}
            code={SLIDE_CODE}
          />
          <MotionExample
            title="Typewriter"
            caption="Snap-reveal per letter, full string stays visible"
            replayKey={replayKeyFor(2)}
            onReplay={() => bump(2)}
            background="#0f172a"
            textColor="#fafafa"
            demo={<TypewriterHero />}
            code={TYPEWRITER_CODE}
          />
          <MotionExample
            title="Pop in + scale bounce"
            caption="Spring-like scale on a key word"
            replayKey={replayKeyFor(3 - 3)}
            onReplay={() => bump(0)}
            background="#fef3c7"
            textColor="#1c1917"
            demo={<PopHero />}
            code={POP_CODE}
          />
        </div>

        <p className="mt-8 text-center text-xs text-neutral-500">
          Want one of these as a starting point? Open the editor and click Save → swap text → Export.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
 * Demo components — hand-written to match what the exporter
 * generates. Keep these synced if you change the export shape.
 * ============================================================ */

function StaggerHero() {
  const word = "Welcome";
  return (
    <h3
      className="text-3xl font-extrabold tracking-tight sm:text-4xl"
      aria-label={word + " to reactimate."}
    >
      <span style={{ display: "inline-block" }}>
        {Array.from(word).map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 + i * 0.05, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >
            {ch}
          </motion.span>
        ))}
      </span>
      <span style={{ opacity: 0.55 }}> to reactimate.</span>
    </h3>
  );
}

const STAGGER_CODE = `import { motion } from "motion/react";

export function Hero() {
  const word = "Welcome";
  return (
    <h1 aria-label={word + " to reactimate."}>
      <span style={{ display: "inline-block" }}>
        {Array.from(word).map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 + i * 0.05, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >
            {ch}
          </motion.span>
        ))}
      </span>
      <span style={{ opacity: 0.55 }}> to reactimate.</span>
    </h1>
  );
}`;

function SlideShiftHero() {
  return (
    <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">
      The new way to{" "}
      <motion.span
        initial={{ opacity: 0, x: -24, color: "#a3a3a3" }}
        animate={{ opacity: 1, x: 0, color: "#0ea5e9" }}
        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >
        animate.
      </motion.span>
    </h3>
  );
}

const SLIDE_CODE = `import { motion } from "motion/react";

export function Hero() {
  return (
    <h1>
      The new way to{" "}
      <motion.span
        initial={{ opacity: 0, x: -24, color: "#a3a3a3" }}
        animate={{ opacity: 1, x: 0, color: "#0ea5e9" }}
        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >
        animate.
      </motion.span>
    </h1>
  );
}`;

function TypewriterHero() {
  const line = "Type it out, character by character.";
  return (
    <h3 className="font-mono text-xl tracking-tight sm:text-2xl">
      <span style={{ display: "inline-block" }}>
        {Array.from(line).map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.001,
              delay: 0.08 + i * 0.05,
              ease: "linear",
            }}
            style={{ display: "inline-block" }}
          >
            {ch === " " ? " " : ch}
          </motion.span>
        ))}
      </span>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        style={{ display: "inline-block", marginLeft: 2 }}
      >
        _
      </motion.span>
    </h3>
  );
}

const TYPEWRITER_CODE = `import { motion } from "motion/react";

const line = "Type it out, character by character.";

export function Hero() {
  return (
    <h1 style={{ fontFamily: "ui-monospace, JetBrains Mono, monospace" }}>
      <span style={{ display: "inline-block" }}>
        {Array.from(line).map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.001,
              delay: 0.08 + i * 0.05,
              ease: "linear",
            }}
            style={{ display: "inline-block" }}
          >
            {ch === " " ? "\\u00a0" : ch}
          </motion.span>
        ))}
      </span>
    </h1>
  );
}`;

function PopHero() {
  return (
    <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
      Make it{" "}
      <motion.span
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: [0.6, 1.15, 1] }}
        transition={{
          duration: 0.7,
          delay: 0.3,
          times: [0, 0.7, 1],
          ease: ["easeOut", "easeOut"],
        }}
        style={{ display: "inline-block", color: "#d97706" }}
      >
        pop.
      </motion.span>
    </h3>
  );
}

const POP_CODE = `import { motion } from "motion/react";

export function Hero() {
  return (
    <h1>
      Make it{" "}
      <motion.span
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: [0.6, 1.15, 1] }}
        transition={{
          duration: 0.7,
          delay: 0.3,
          times: [0, 0.7, 1],
          ease: ["easeOut", "easeOut"],
        }}
        style={{ display: "inline-block", color: "#d97706" }}
      >
        pop.
      </motion.span>
    </h1>
  );
}`;
