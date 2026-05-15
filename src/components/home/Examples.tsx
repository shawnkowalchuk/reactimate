import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Fireworks } from "fireworks-js";
import { useProjectStore } from "../../store/projectStore";
import { markSkipCloudSync } from "../../persistence/useCloudSync";
import type {
  Component,
  ComponentStyle,
  Effect,
  Project,
} from "../../types/project";
import { newId } from "../../utils/id";
import { MotionExample } from "./MotionExample";

/* ============================================================
 * Helpers — build mini Projects matching each demo so the user
 * can "Open in Editor" and see the same canonical structure they
 * would have built by hand: every visible chunk of text is its
 * own component on the timeline.
 *   - Animated chunks get their effect (slide, zoom, etc.).
 *   - Static chunks get a "(no effect)" placeholder spanning the
 *     whole timeline, which keeps the text visible AND surfaces
 *     it on the timeline so the user can later drop a real
 *     effect on it.
 *
 * Plain (un-componentized) text is intentionally hidden by the
 * preview engine — see RenderedText.tsx — so all visible text
 * MUST live on a component.
 * ============================================================ */
function makeMiniProject(
  text: string,
  components: Project["layer"]["components"],
  duration = 3,
): Project {
  return {
    id: newId("proj"),
    name: "Example",
    duration,
    canvas: { preset: "16:9", width: 1200, height: 675, background: "#0a0a0a" },
    defaultTextStyle: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 72,
      color: "#fafafa",
      fontWeight: 700,
    },
    layer: { id: newId("layer"), text, components, alignment: "center", lineHeight: 1.1 },
  };
}

interface AnimatedRange {
  /** [start, end) char range in the layer text. May span words. */
  range: [number, number];
  /** Timeline-chip color (the dot/bar in the timeline UI). */
  color: string;
  /** Optional partial overrides on the example's default style. */
  styleOverride?: Partial<ComponentStyle>;
  /** Effect(s) on this animated component. */
  effects: Effect[];
}

/**
 * Tokenize `text` on whitespace and emit one Component per word
 * for every word NOT covered by an animated range. Then emit one
 * Component per animated range (which may span multiple words).
 * Output is sorted by startIndex so the timeline order matches
 * the reading order of the text.
 *
 * Static components get one `custom` effect ("(no effect)") at
 * [0, projectDuration) so they're always visible AND show up as
 * a timeline row that the user can later swap to a real effect.
 */
function makeWordComponents(
  text: string,
  defaultStyle: ComponentStyle,
  projectDuration: number,
  animated: AnimatedRange[],
): Component[] {
  const words: Array<[number, number]> = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    words.push([m.index, m.index + m[0].length]);
  }

  const inAnimated = (s: number, e: number): boolean =>
    animated.some(({ range }) => range[0] <= s && range[1] >= e);

  const out: Component[] = [];
  for (const [s, e] of words) {
    if (inAnimated(s, e)) continue;
    out.push({
      id: newId("comp"),
      startIndex: s,
      endIndex: e,
      color: defaultStyle.color,
      style: { ...defaultStyle },
      effects: [
        {
          id: newId("fx"),
          type: "custom",
          startTime: 0,
          duration: projectDuration,
          easing: "linear",
          targets: {},
        },
      ],
    });
  }
  for (const a of animated) {
    out.push({
      id: newId("comp"),
      startIndex: a.range[0],
      endIndex: a.range[1],
      color: a.color,
      style: { ...defaultStyle, ...a.styleOverride },
      effects: a.effects,
    });
  }
  out.sort((a, b) => a.startIndex - b.startIndex);
  return out;
}

/**
 * Convenience: build a complete Project from text + style + animated ranges.
 * Equivalent to `makeMiniProject(text, makeWordComponents(...), duration)`.
 */
function buildExample(
  text: string,
  defaultStyle: ComponentStyle,
  duration: number,
  animated: AnimatedRange[],
): Project {
  return makeMiniProject(
    text,
    makeWordComponents(text, defaultStyle, duration, animated),
    duration,
  );
}

/** Base component style — examples spread this and override per-case. */
const BASE_STYLE: ComponentStyle = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 72,
  fontWeight: 700,
  color: "#fafafa",
  letterSpacing: 0,
  alignment: "center",
  x: 0,
  y: 0,
  opacity: 1,
  scale: 1,
  rotation: 0,
  blur: 0,
};

/* Fisher-Yates shuffle with a simple seed-based RNG so the order
   is consistent across renders (won't change on re-mount). */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
 * Example page — paginated, shuffled, sliding grid of 16 demos.
 * ============================================================ */
const PER_PAGE = 4;

export function Examples() {
  const [loopTick, setLoopTick] = useState(0);
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const [bumps, setBumps] = useState<number[]>(Array.from({ length: 16 }, () => 0));
  const navigate = useNavigate();
  const setProject = useProjectStore((s) => s.setProject);

  useEffect(() => {
    const id = window.setInterval(() => setLoopTick((n) => n + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const bump = (i: number) =>
    setBumps((arr) => arr.map((v, j) => (j === i ? v + 1 : v)));
  const replayKeyFor = (i: number) => loopTick * 1000 + bumps[i];

  const shuffled = useMemo(() => seededShuffle(EXAMPLES, 42), []);
  const maxPage = Math.max(0, Math.floor((shuffled.length - 1) / PER_PAGE));
  const slice = shuffled.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const go = (dir: number) => {
    const next = page + dir;
    if (next < 0 || next > maxPage) return;
    setDirection(dir);
    setPage(next);
  };

  const onOpenInEditor = (project: Project) => {
    markSkipCloudSync();
    setProject(project);
    navigate("/app");
  };

  return (
    <section id="examples" className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Examples</h2>
          <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
            Built with reactimate. Click <strong>Open in Editor</strong> to tweak and export any example.
          </p>
        </div>

        <div className="mt-10 flex items-stretch">
          {/* Left arrow */}
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={page === 0}
            className="flex w-10 shrink-0 items-center justify-center self-stretch text-neutral-400 transition-colors disabled:opacity-20 enabled:hover:text-neutral-900 dark:text-neutral-600 dark:enabled:hover:text-neutral-200"
            aria-label="Previous page"
          >
            <ChevronLeft size={36} />
          </button>

          {/* Cards grid with slide animation */}
          <div className="relative flex-1 overflow-hidden">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={page}
                custom={direction}
                initial={{ x: direction > 0 ? 200 : -200, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? -200 : 200, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="grid gap-6 lg:grid-cols-2"
              >
                {slice.map((ex, idx) => {
                  const globalIdx = page * PER_PAGE + idx;
                  return (
                    <div key={globalIdx}>
                      <MotionExample
                        title={ex.title}
                        caption={ex.caption}
                        replayKey={replayKeyFor(shuffled.indexOf(ex))}
                        onReplay={() => bump(shuffled.indexOf(ex))}
                        onOpenInEditor={() => onOpenInEditor(ex.project)}
                        background={ex.background}
                        textColor={ex.textColor}
                        demo={ex.demo}
                        code={ex.code}
                      />
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right arrow */}
          <button
            type="button"
            onClick={() => go(1)}
            disabled={page >= maxPage}
            className="flex w-10 shrink-0 items-center justify-center self-stretch text-neutral-400 transition-colors disabled:opacity-20 enabled:hover:text-neutral-900 dark:text-neutral-600 dark:enabled:hover:text-neutral-200"
            aria-label="Next page"
          >
            <ChevronRight size={36} />
          </button>
        </div>

        <div className="mt-4 text-center">
          <span className="text-xs tabular-nums text-neutral-400">
            {page + 1} / {maxPage + 1}
          </span>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Want one as a starting point? Hover a card and click <strong>Open in Editor</strong>.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
 * Demo components + code strings + mini projects (16 total)
 * ============================================================ */

/* ---- 1. Stagger fade ---- */
function StaggerHero() {
  const word = "Welcome";
  return (
    <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl" aria-label={word + " to reactimate."}>
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
          >{ch}</motion.span>
        ))}
      </span>
      <span style={{ opacity: 0.55 }}> to reactimate.</span>
    </h1>
  );
}`;
const staggerProj = buildExample(
  "Welcome to reactimate.",
  { ...BASE_STYLE, fontWeight: 800, letterSpacing: -1 },
  3.5,
  [{
    range: [0, 7], color: "#fbbf24",
    effects: [{
      id: newId("fx"), type: "zoom", startTime: 0.1, duration: 3, easing: "ease-out",
      from: { opacity: 0, y: 18 }, targets: { opacity: 1, y: 0 },
      staggerLetters: true, staggerDelay: 0.05,
    }],
  }],
);

/* ---- 2. Slide + color shift ---- */
function SlideShiftHero() {
  return (
    <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">
      The new way to{" "}
      <motion.span
        initial={{ opacity: 0, x: -24, color: "#a3a3a3" }}
        animate={{ opacity: 1, x: 0, color: "#0ea5e9" }}
        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >animate.</motion.span>
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
      >animate.</motion.span>
    </h1>
  );
}`;
const slideProj = buildExample(
  "The new way to animate.",
  { ...BASE_STYLE, fontWeight: 700 },
  3.5,
  [{
    range: [15, 23], color: "#0ea5e9", styleOverride: { color: "#0ea5e9" },
    effects: [{
      id: newId("fx"), type: "slide", startTime: 0.3, duration: 3, easing: "ease-out",
      from: { opacity: 0, x: -24, color: "#a3a3a3" },
      targets: { opacity: 1, x: 0, color: "#0ea5e9" },
    }],
  }],
);

/* ---- 3. Typewriter ---- */
function TypewriterHero() {
  const line = "Type it out,\ncharacter by character.";
  return (
    <h3 className="font-mono text-xl tracking-tight sm:text-2xl">
      <span style={{ display: "inline-block" }}>
        {Array.from(line).map((ch, i) => {
          if (ch === "\n") return <br key={i} />;
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.001, delay: 0.08 + i * 0.05, ease: "linear" }}
              style={{ display: "inline-block" }}
            >{ch === " " ? "\u00a0" : ch}</motion.span>
          );
        })}
      </span>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        style={{ display: "inline-block", marginLeft: 2 }}
      >_</motion.span>
    </h3>
  );
}
const TYPEWRITER_CODE = `import { motion } from "motion/react";
const line = "Type it out,\\ncharacter by character.";
export function Hero() {
  return (
    <h1 style={{ fontFamily: "ui-monospace, monospace" }}>
      <span style={{ display: "inline-block" }}>
        {Array.from(line).map((ch, i) => {
          if (ch === "\\n") return <br key={i} />;
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.001, delay: 0.08 + i * 0.05 }}
              style={{ display: "inline-block" }}
            >{ch === " " ? "\\u00a0" : ch}</motion.span>
          );
        })}
      </span>
    </h1>
  );
}`;
const typewriterProj = buildExample(
  "Type it out,\ncharacter by character.",
  { ...BASE_STYLE, fontFamily: "ui-monospace, monospace", fontSize: 36, fontWeight: 400 },
  3,
  [{
    range: [0, 36], color: "#22d3ee",
    effects: [{
      id: newId("fx"), type: "typewriter", startTime: 0, duration: 2.5, easing: "linear",
      targets: { opacity: 1 }, typewriter: { mode: "snap" },
      staggerLetters: true, staggerDelay: 0.05,
    }],
  }],
);

/* ---- 4. Pop in + scale bounce ---- */
function PopHero() {
  return (
    <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
      Make it{" "}
      <motion.span
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: [0.6, 1.15, 1] }}
        transition={{ duration: 0.7, delay: 0.3, times: [0, 0.7, 1], ease: ["easeOut", "easeOut"] }}
        style={{ display: "inline-block", color: "#d97706" }}
      >pop.</motion.span>
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
        transition={{ duration: 0.7, delay: 0.3, times: [0, 0.7, 1], ease: ["easeOut", "easeOut"] }}
        style={{ display: "inline-block", color: "#d97706" }}
      >pop.</motion.span>
    </h1>
  );
}`;
const popProj = buildExample(
  "Make it pop.",
  { ...BASE_STYLE, fontWeight: 800, letterSpacing: -1 },
  2.5,
  [{
    range: [8, 12], color: "#d97706", styleOverride: { color: "#d97706" },
    effects: [{
      id: newId("fx"), type: "zoom", startTime: 0.3, duration: 2, easing: "ease-out",
      from: { scale: 0.6, opacity: 0 }, targets: { scale: 1, opacity: 1 },
    }],
  }],
);

/* ---- 5. Blur reveal ---- */
function BlurHero() {
  return ( <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl"><motion.span initial={{ filter: "blur(8px)", opacity: 0 }} animate={{ filter: "blur(0px)", opacity: 1 }} transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }} style={{ display: "inline-block" }}>Come into focus.</motion.span></h3> );
}
const BLUR_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (<h1><motion.span initial={{ filter: "blur(8px)", opacity: 0 }} animate={{ filter: "blur(0px)", opacity: 1 }} transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }} style={{ display: "inline-block" }}>Come into focus.</motion.span></h1>);
}`;
const blurProj = buildExample(
  "Come into focus.",
  { ...BASE_STYLE, fontWeight: 800, letterSpacing: -1 },
  2.5,
  [{
    range: [0, 16], color: "#a78bfa",
    effects: [{
      id: newId("fx"), type: "blur", startTime: 0.1, duration: 2, easing: "ease-out",
      from: { blur: 8, opacity: 0 }, targets: { blur: 0, opacity: 1 },
    }],
  }],
);

/* ---- 6. Slide up + fade ---- */
function SlideUpHero() {
  return (
    <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">
      <motion.span
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >Rise up slowly.</motion.span>
    </h3>
  );
}
const SLIDEUP_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (
    <h1>
      <motion.span
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >Rise up slowly.</motion.span>
    </h1>
  );
}`;
const slideUpProj = buildExample(
  "Rise up slowly.",
  { ...BASE_STYLE, fontWeight: 800 },
  3,
  [{
    range: [0, 15], color: "#34d399", styleOverride: { color: "#34d399" },
    effects: [{
      id: newId("fx"), type: "slide", startTime: 0.2, duration: 2.5, easing: "ease-out",
      from: { opacity: 0, y: 40 }, targets: { opacity: 1, y: 0 },
    }],
  }],
);

/* ---- 8. Color flash ---- */
function ColorFlashHero() {
  return (
    <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">
      Turn up the{" "}
      <motion.span
        initial={{ color: "#a3a3a3" }}
        animate={{ color: "#f97316" }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >heat.</motion.span>
    </h3>
  );
}
const COLOR_FLASH_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (
    <h1>
      Turn up the{" "}
      <motion.span
        initial={{ color: "#a3a3a3" }}
        animate={{ color: "#f97316" }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >heat.</motion.span>
    </h1>
  );
}`;
const colorFlashProj = buildExample(
  "Turn up the heat.",
  { ...BASE_STYLE, fontWeight: 700 },
  3,
  [{
    range: [12, 17], color: "#f97316", styleOverride: { color: "#f97316" },
    effects: [{
      id: newId("fx"), type: "color-shift", startTime: 0.3, duration: 2.5, easing: "ease-out",
      from: { color: "#a3a3a3" }, targets: { color: "#f97316" },
    }],
  }],
);

/* ---- 9. Stagger zoom ---- */
function StaggerZoomHero() {
  const word = "Amplify";
  return (
    <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl" aria-label={word}>
      <span style={{ display: "inline-block" }}>
        {Array.from(word).map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.06, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >{ch}</motion.span>
        ))}
      </span>
    </h3>
  );
}
const STAGGER_ZOOM_CODE = `import { motion } from "motion/react";
const word = "Amplify";
export function Hero() {
  return (
    <h1>
      <span style={{ display: "inline-block" }}>
        {Array.from(word).map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.06, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >{ch}</motion.span>
        ))}
      </span>
    </h1>
  );
}`;
const staggerZoomProj = buildExample(
  "Amplify",
  { ...BASE_STYLE, fontWeight: 800, letterSpacing: -1 },
  3,
  [{
    range: [0, 7], color: "#818cf8",
    effects: [{
      id: newId("fx"), type: "zoom", startTime: 0.2, duration: 2.5, easing: "ease-out",
      from: { scale: 0.5, opacity: 0, y: 20 }, targets: { scale: 1, opacity: 1, y: 0 },
      staggerLetters: true, staggerDelay: 0.06,
    }],
  }],
);

/* ---- 11. Spring bounce ---- */
function BounceHero() {
  return (
    <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
      <motion.span
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 400, damping: 10 }}
        style={{ display: "inline-block" }}
      >Boing!</motion.span>
    </h3>
  );
}
const BOUNCE_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (
    <h1>
      <motion.span
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 400, damping: 10 }}
        style={{ display: "inline-block" }}
      >Boing!</motion.span>
    </h1>
  );
}`;
const bounceProj = buildExample(
  "Boing!",
  { ...BASE_STYLE, fontWeight: 800, letterSpacing: -1 },
  2.5,
  [{
    range: [0, 6], color: "#facc15",
    effects: [{
      id: newId("fx"), type: "slide", startTime: 0, duration: 2, easing: "spring",
      from: { opacity: 0, y: -40 }, targets: { opacity: 1, y: 0 },
    }],
  }],
);

/* ---- 12. Multi-word cascade ---- */
function CascadeHero() {
  const words = ["Design.", "Build.", "Ship."];
  return (
    <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">
      {words.map((w, i) => (
        <motion.span
          key={w}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 + i * 0.25, ease: "easeOut" }}
          style={{ display: "inline-block", marginRight: "0.4em" }}
        >{w}</motion.span>
      ))}
    </h3>
  );
}
const CASCADE_CODE = `import { motion } from "motion/react";
export function Hero() {
  const words = ["Design.", "Build.", "Ship."];
  return (
    <h1>
      {words.map((w, i) => (
        <motion.span
          key={w}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 + i * 0.25, ease: "easeOut" }}
          style={{ display: "inline-block", marginRight: "0.4em" }}
        >{w}</motion.span>
      ))}
    </h1>
  );
}`;
const cascadeProj = buildExample(
  "Design. Build. Ship.",
  { ...BASE_STYLE, fontWeight: 700 },
  3.5,
  [
    {
      range: [0, 7], color: "#38bdf8", styleOverride: { color: "#38bdf8" },
      effects: [{ id: newId("fx"), type: "slide", startTime: 0.2, duration: 2.5, easing: "ease-out", from: { opacity: 0, x: -30 }, targets: { opacity: 1, x: 0 } }],
    },
    {
      range: [8, 14], color: "#f472b6", styleOverride: { color: "#f472b6" },
      effects: [{ id: newId("fx"), type: "slide", startTime: 0.45, duration: 2.5, easing: "ease-out", from: { opacity: 0, x: -30 }, targets: { opacity: 1, x: 0 } }],
    },
    {
      range: [15, 20], color: "#a78bfa", styleOverride: { color: "#a78bfa" },
      effects: [{ id: newId("fx"), type: "slide", startTime: 0.7, duration: 2.5, easing: "ease-out", from: { opacity: 0, x: -30 }, targets: { opacity: 1, x: 0 } }],
    },
  ],
);

/* ---- 13. Particle burst ---- */
function ParticleBurstHero() {
  const stars = Array.from({ length: 24 }, (_, i) => ({
    key: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 4 + Math.random() * 8,
    delay: Math.random() * 1.5,
    duration: 0.8 + Math.random() * 1.2,
  }));
  return (
    <div className="relative">
      <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl relative z-10">
        Sprinkle{" "}
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          style={{ display: "inline-block", color: "#fbbf24" }}
        >magic.</motion.span>
      </h3>
      {stars.map((s) => (
        <motion.div
          key={s.key}
          className="absolute rounded-full bg-yellow-400 z-20"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.5] }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            repeatDelay: Math.random() * 2,
            ease: "easeInOut",
          }}
          style={{
            width: s.size,
            height: s.size,
            // left/top percentages are relative to the parent's bounding
            // box. Using motion's `x`/`y` percent here would resolve to
            // the star's OWN size (4-12px), clustering all stars near
            // the origin.
            left: `${s.x}%`,
            top: `${s.y}%`,
          }}
        />
      ))}
    </div>
  );
}
const PARTICLE_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (
    <h1>
      Sprinkle{" "}
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        style={{ display: "inline-block", color: "#fbbf24" }}
      >magic.</motion.span>
    </h1>
  );
}`;
const particleProj = buildExample(
  "Sprinkle magic.",
  { ...BASE_STYLE, fontWeight: 800, letterSpacing: -1 },
  3.5,
  [{
    range: [9, 15], color: "#fbbf24", styleOverride: { color: "#fbbf24" },
    effects: [
      { id: newId("fx"), type: "zoom", startTime: 0.2, duration: 3, easing: "ease-out", from: { scale: 0.8, opacity: 0 }, targets: { scale: 1, opacity: 1 } },
      { id: newId("fx"), type: "particle", startTime: 0, duration: 3, easing: "linear", targets: {}, particle: { density: 18, size: 14, color: "#fbbf24", preset: "gold", shape: "star", type: "standard", mode: "around", rangePx: 40 } },
    ],
  }],
);

/* ---- 14. Fireworks launch ---- */
function FireworksHero() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fwRef = useRef<Fireworks | null>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const sync = () => {
      const r = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width));
      canvas.height = Math.max(1, Math.round(r.height));
    };
    sync();
    const fw = new Fireworks(canvas, {
      autoresize: false,
      opacity: 0.6,
      particles: 60,
      explosion: 6,
      intensity: 30,
      delay: { min: 60, max: 200 },
      hue: { min: 0, max: 30 },
      rocketsPoint: { min: 30, max: 70 },
      lineWidth: { explosion: { min: 1, max: 3 }, trace: { min: 1, max: 2 } },
      mouse: { click: false, move: false, max: 1 },
      sound: { enabled: false },
    });
    fwRef.current = fw;
    fw.start();
    const ro = new ResizeObserver(() => {
      sync();
      fw.updateSize({ width: canvas.width, height: canvas.height });
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      // Use stop(false) — passing true calls canvas.remove() from the DOM,
      // and on React strict-mode re-mount the next createCanvas call sees
      // canvas.isConnected === false and re-attaches it to document.body,
      // making fireworks render across the entire viewport.
      fw.stop(false);
      fwRef.current = null;
    };
  }, []);
  // The wrapper is `absolute inset-0` of MotionExample's outer relative div
  // (the only positioned ancestor up the tree), so it fills the entire
  // preview pane (h-56 × full card width). overflow-hidden clips any pixels
  // at that boundary.
  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <h3 className="text-3xl font-bold tracking-tight sm:text-4xl relative z-10">
          <motion.span
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            style={{ display: "inline-block", color: "#f87171" }}
          >Celebrate!</motion.span>
        </h3>
      </div>
    </div>
  );
}
const FIREWORKS_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (
    <h1>
      <motion.span
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        style={{ display: "inline-block", color: "#f87171" }}
      >Celebrate!</motion.span>
    </h1>
  );
}`;
const fireworksProj = buildExample(
  "Celebrate!",
  { ...BASE_STYLE, fontWeight: 800, letterSpacing: -1 },
  4.5,
  [{
    range: [0, 10], color: "#f87171", styleOverride: { color: "#f87171" },
    effects: [
      { id: newId("fx"), type: "slide", startTime: 0.1, duration: 4, easing: "ease-out", from: { opacity: 0, y: 30 }, targets: { opacity: 1, y: 0 } },
      { id: newId("fx"), type: "fireworks-js", startTime: 0.5, duration: 3.5, easing: "linear", targets: {}, fireworks: { density: 60, explosion: 6, gravity: 1.5, opacity: 0.6, flickering: 50, acceleration: 1.05, friction: 0.97, traceLength: 3, traceSpeed: 10, intensity: 35, lineStyle: "round", mode: "around", spreadRadius: 200, delayMin: 80, delayMax: 300, brightnessMin: 50, brightnessMax: 80, decayMin: 0.015, decayMax: 0.03, hueMin: 0, hueMax: 30 } },
    ],
  }],
);

/* ---- 16. Fade + letter-spacing reveal ---- */
function LetterSpacingHero() {
  const word = "Stretch";
  return (
    <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl" aria-label={word}>
      <span style={{ display: "inline-block" }}>
        {Array.from(word).map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, letterSpacing: "0.3em" }}
            animate={{ opacity: 1, letterSpacing: "0em" }}
            transition={{ duration: 0.5, delay: 0.05 + i * 0.04, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >{ch}</motion.span>
        ))}
      </span>
    </h3>
  );
}
const LETTER_SPACING_CODE = `import { motion } from "motion/react";
export function Hero() {
  const word = "Stretch";
  return (
    <h1>
      <span style={{ display: "inline-block" }}>
        {Array.from(word).map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, letterSpacing: "0.3em" }}
            animate={{ opacity: 1, letterSpacing: "0em" }}
            transition={{ duration: 0.5, delay: 0.05 + i * 0.04, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >{ch}</motion.span>
        ))}
      </span>
    </h1>
  );
}`;
const letterSpacingProj = buildExample(
  "Stretch",
  { ...BASE_STYLE, fontWeight: 800, letterSpacing: -1 },
  3,
  [{
    range: [0, 7], color: "#34d399",
    effects: [{
      id: newId("fx"), type: "zoom", startTime: 0.05, duration: 2.5, easing: "ease-out",
      from: { opacity: 0 }, targets: { opacity: 1 },
      staggerLetters: true, staggerDelay: 0.04,
    }],
  }],
);

/* ---- 7. Rotate twist ---- */
function RotateHero() {
  return ( <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl"><motion.span initial={{ opacity: 0, rotate: -12, scale: 0.8 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }} style={{ display: "inline-block" }}>Twist into view.</motion.span></h3> );
}
const ROTATE_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (<h1><motion.span initial={{ opacity: 0, rotate: -12, scale: 0.8 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }} style={{ display: "inline-block" }}>Twist into view.</motion.span></h1>);
}`;

const rotateProj = buildExample(
  "Twist into view.",
  { ...BASE_STYLE, fontWeight: 800, letterSpacing: -1 },
  3,
  [{
    range: [0, 16], color: "#f472b6",
    effects: [{
      id: newId("fx"), type: "rotate", startTime: 0.1, duration: 2.5, easing: "ease-out",
      from: { opacity: 0, rotation: -12, scale: 0.8 },
      targets: { opacity: 1, rotation: 0, scale: 1 },
    }],
  }],
);

/* ---- 10. Masked slide ---- */
function MaskSlideHero() {
  return ( <h3 className="text-3xl font-bold tracking-tight sm:text-4xl"><span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}><motion.span initial={{ x: -200, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }} style={{ display: "inline-block" }}>Reveal from behind.</motion.span></span></h3> );
}
const MASK_SLIDE_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (<h1><span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}><motion.span initial={{ x: -200, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }} style={{ display: "inline-block" }}>Reveal from behind.</motion.span></span></h1>);
}`;

const maskSlideProj = buildExample(
  "Reveal from behind.",
  { ...BASE_STYLE, fontWeight: 700 },
  3,
  [{
    range: [0, 19], color: "#2dd4bf",
    effects: [{
      id: newId("fx"), type: "slide", startTime: 0.3, duration: 2.5, easing: "ease-out",
      from: { opacity: 0, x: -200 }, targets: { opacity: 1, x: 0 }, maskBox: true,
    }],
  }],
);

/* ---- 15. Double zoom pop ---- */
function DoubleZoomHero() {
  return ( <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl"><motion.span initial={{ opacity: 0, scale: 0.3, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }} style={{ display: "inline-block" }}>Pop out!</motion.span></h3> );
}
const DOUBLE_ZOOM_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (<h1><motion.span initial={{ opacity: 0, scale: 0.3, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }} style={{ display: "inline-block" }}>Pop out!</motion.span></h1>);
}`;

const doubleZoomProj = buildExample(
  "Pop out!",
  { ...BASE_STYLE, fontWeight: 800, letterSpacing: -1 },
  2.5,
  [{
    range: [0, 8], color: "#c084fc", styleOverride: { color: "#c084fc" },
    effects: [{
      id: newId("fx"), type: "zoom", startTime: 0.1, duration: 2, easing: "ease-out",
      from: { scale: 0.3, opacity: 0, y: -20 },
      targets: { scale: 1, opacity: 1, y: 0 },
    }],
  }],
);

/* ---- Register all 16 ---- */
interface ExampleEntry {
  title: string;
  caption: string;
  demo: React.ReactNode;
  code: string;
  background: string;
  textColor: string;
  project: Project;
}

const EXAMPLES: ExampleEntry[] = [
  { title: "Welcome — stagger fade", caption: "Per-letter fade with reverse stagger", demo: <StaggerHero />, code: STAGGER_CODE, background: "#0a0a0a", textColor: "#fafafa", project: staggerProj },
  { title: "Slide + color shift", caption: "Multi-prop transition with consolidated timing", demo: <SlideShiftHero />, code: SLIDE_CODE, background: "#ffffff", textColor: "#0a0a0a", project: slideProj },
  { title: "Typewriter", caption: "Snap-reveal per letter, full string stays visible", demo: <TypewriterHero />, code: TYPEWRITER_CODE, background: "#0f172a", textColor: "#fafafa", project: typewriterProj },
  { title: "Pop in + scale bounce", caption: "Spring-like scale on a key word", demo: <PopHero />, code: POP_CODE, background: "#fef3c7", textColor: "#1c1917", project: popProj },
  { title: "Blur into focus", caption: "CSS blur(8px) → 0px with a fade in", demo: <BlurHero />, code: BLUR_CODE, background: "#18181b", textColor: "#fafafa", project: blurProj },
  { title: "Slide up + fade", caption: "Rises from below with simultaneous opacity", demo: <SlideUpHero />, code: SLIDEUP_CODE, background: "#022c22", textColor: "#34d399", project: slideUpProj },
  { title: "Rotate twist", caption: "Rotates in from -12° with a subtle scale", demo: <RotateHero />, code: ROTATE_CODE, background: "#1e1b4b", textColor: "#fafafa", project: rotateProj },
  { title: "Color flash", caption: "Single word shifts from grey to orange", demo: <ColorFlashHero />, code: COLOR_FLASH_CODE, background: "#fafaf9", textColor: "#1c1917", project: colorFlashProj },
  { title: "Stagger zoom", caption: "Each letter scales up from 0.5 to 1", demo: <StaggerZoomHero />, code: STAGGER_ZOOM_CODE, background: "#0c0a20", textColor: "#fafafa", project: staggerZoomProj },
  { title: "Masked slide", caption: "Text slides in from behind a bounding box", demo: <MaskSlideHero />, code: MASK_SLIDE_CODE, background: "#0f172a", textColor: "#2dd4bf", project: maskSlideProj },
  { title: "Spring bounce", caption: "Falls in with spring physics for a playful entrance", demo: <BounceHero />, code: BOUNCE_CODE, background: "#1c1917", textColor: "#facc15", project: bounceProj },
  { title: "Multi-word cascade", caption: "Three words cascade in staggered sequence", demo: <CascadeHero />, code: CASCADE_CODE, background: "#0f172a", textColor: "#fafafa", project: cascadeProj },
  { title: "Particle burst", caption: "Zoom-in with floating star particles", demo: <ParticleBurstHero />, code: PARTICLE_CODE, background: "#1c1917", textColor: "#fafafa", project: particleProj },
  { title: "Fireworks launch", caption: "Text slides up over real firework bursts", demo: <FireworksHero />, code: FIREWORKS_CODE, background: "#0f172a", textColor: "#f87171", project: fireworksProj },
  { title: "Double zoom pop", caption: "Springy zoom from 0.3x with custom cubic bezier", demo: <DoubleZoomHero />, code: DOUBLE_ZOOM_CODE, background: "#1e1b4b", textColor: "#c084fc", project: doubleZoomProj },
  { title: "Letter-spacing reveal", caption: "Characters compress into place with stagger", demo: <LetterSpacingHero />, code: LETTER_SPACING_CODE, background: "#022c22", textColor: "#34d399", project: letterSpacingProj },
];
