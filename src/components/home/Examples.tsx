import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Fireworks } from "fireworks-js";
import { useProjectStore } from "../../store/projectStore";
import type { Project } from "../../types/project";
import { newId } from "../../utils/id";
import { MotionExample } from "./MotionExample";

/* ============================================================
 * Helper — build a mini Project matching a demo for "Open in
 * Editor" so the user can tweak the text and re-export.
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
const staggerProj = makeMiniProject("Welcome to reactimate.", [{
  id: newId("comp"), startIndex: 0, endIndex: 7, color: "#fbbf24",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 800, color: "#fafafa", letterSpacing: -1, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "fade", startTime: 0.1, duration: 0.6, easing: "ease-out", targets: { opacity: 1 }, staggerLetters: true, staggerDelay: 0.05 }],
}]);

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
const slideProj = makeMiniProject("The new way to animate.", [{
  id: newId("comp"), startIndex: 15, endIndex: 23, color: "#0ea5e9",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 700, color: "#0ea5e9", letterSpacing: 0, alignment: "center", x: 0, y: 0, opacity: 1, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "slide", startTime: 0, duration: 0.7, easing: "ease-out", from: { opacity: 0, x: -100 }, targets: { opacity: 1, x: 0 } }],
}]);

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
const typewriterProj = makeMiniProject("Type it out,\ncharacter by character.", [{
  id: newId("comp"), startIndex: 0, endIndex: 36, color: "#22d3ee",
  style: { fontFamily: "ui-monospace, monospace", fontSize: 36, fontWeight: 400, color: "#fafafa", letterSpacing: 0, alignment: "center", x: 0, y: 0, opacity: 1, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "typewriter", startTime: 0, duration: 2, easing: "linear", targets: { opacity: 1 }, typewriter: { mode: "snap" }, staggerLetters: true }],
}]);

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
const popProj = makeMiniProject("Make it pop.", [{
  id: newId("comp"), startIndex: 8, endIndex: 12, color: "#d97706",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 800, color: "#d97706", letterSpacing: -1, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "zoom", startTime: 0, duration: 0.7, easing: "ease-out", from: { scale: 0.6, opacity: 0 }, targets: { scale: 1, opacity: 1 } }],
}], 2);

/* ---- 5. Blur reveal ---- */
function BlurHero() {
  return (
    <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
      <motion.span
        initial={{ filter: "blur(8px)", opacity: 0 }}
        animate={{ filter: "blur(0px)", opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >Come into focus.</motion.span>
    </h3>
  );
}
const BLUR_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (
    <h1>
      <motion.span
        initial={{ filter: "blur(8px)", opacity: 0 }}
        animate={{ filter: "blur(0px)", opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >Come into focus.</motion.span>
    </h1>
  );
}`;
const blurProj = makeMiniProject("Come into focus.", [{
  id: newId("comp"), startIndex: 0, endIndex: 16, color: "#a78bfa",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 800, color: "#fafafa", letterSpacing: -1, alignment: "center", x: 0, y: 0, opacity: 1, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "blur", startTime: 0, duration: 0.7, easing: "ease-out", from: { blur: 8, opacity: 0 }, targets: { blur: 0, opacity: 1 } }],
}]);

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
const slideUpProj = makeMiniProject("Rise up slowly.", [{
  id: newId("comp"), startIndex: 0, endIndex: 15, color: "#34d399",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 800, color: "#34d399", letterSpacing: 0, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "slide", startTime: 0, duration: 0.6, easing: "ease-out", from: { opacity: 0, y: 100 }, targets: { opacity: 1, y: 0 } }],
}], 2);

/* ---- 7. Rotate twist ---- */
function RotateHero() {
  return (
    <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
      <motion.span
        initial={{ opacity: 0, rotate: -12, scale: 0.8 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >Twist into view.</motion.span>
    </h3>
  );
}
const ROTATE_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (
    <h1>
      <motion.span
        initial={{ opacity: 0, rotate: -12, scale: 0.8 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >Twist into view.</motion.span>
    </h1>
  );
}`;
const rotateProj = makeMiniProject("Twist into view.", [{
  id: newId("comp"), startIndex: 0, endIndex: 16, color: "#f472b6",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 800, color: "#fafafa", letterSpacing: -1, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "rotate", startTime: 0, duration: 0.6, easing: "ease-out", from: { opacity: 0, rotation: -12 }, targets: { opacity: 1, rotation: 0 } }],
}]);

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
const colorFlashProj = makeMiniProject("Turn up the heat.", [{
  id: newId("comp"), startIndex: 12, endIndex: 17, color: "#f97316",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 700, color: "#f97316", letterSpacing: 0, alignment: "center", x: 0, y: 0, opacity: 1, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "color-shift", startTime: 0, duration: 0.6, easing: "ease-out", from: { color: "#a3a3a3" }, targets: { color: "#f97316" } }],
}]);

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
const staggerZoomProj = makeMiniProject("Amplify", [{
  id: newId("comp"), startIndex: 0, endIndex: 7, color: "#818cf8",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 800, color: "#fafafa", letterSpacing: -1, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "zoom", startTime: 0, duration: 0.8, easing: "ease-out", from: { scale: 0.5, opacity: 0, y: 20 }, targets: { scale: 1, opacity: 1, y: 0 }, staggerLetters: true, staggerDelay: 0.06 }],
}], 2);

/* ---- 10. Masked slide ---- */
function MaskSlideHero() {
  return (
    <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">
      <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}>
        <motion.span
          initial={{ x: -200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          style={{ display: "inline-block" }}
        >Reveal from behind.</motion.span>
      </span>
    </h3>
  );
}
const MASK_SLIDE_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (
    <h1>
      <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}>
        <motion.span
          initial={{ x: -200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          style={{ display: "inline-block" }}
        >Reveal from behind.</motion.span>
      </span>
    </h1>
  );
}`;
const maskSlideProj = makeMiniProject("Reveal from behind.", [{
  id: newId("comp"), startIndex: 0, endIndex: 19, color: "#2dd4bf",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 700, color: "#fafafa", letterSpacing: 0, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "slide", startTime: 0, duration: 0.6, easing: "ease-out", from: { opacity: 0, x: -100 }, targets: { opacity: 1, x: 0 }, maskBox: true }],
}]);

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
const bounceProj = makeMiniProject("Boing!", [{
  id: newId("comp"), startIndex: 0, endIndex: 6, color: "#facc15",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 800, color: "#fafafa", letterSpacing: -1, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "slide", startTime: 0, duration: 0.5, easing: "spring", from: { opacity: 0, y: -100 }, targets: { opacity: 1, y: 0 } }],
}]);

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
const cascadeProj = makeMiniProject("Design. Build. Ship.", [
  { id: newId("comp"), startIndex: 0, endIndex: 7, color: "#38bdf8", style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 700, color: "#38bdf8", letterSpacing: 0, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 }, effects: [{ id: newId("fx"), type: "slide", startTime: 0, duration: 0.5, easing: "ease-out", from: { opacity: 0, x: -50 }, targets: { opacity: 1, x: 0 } }] },
  { id: newId("comp"), startIndex: 8, endIndex: 14, color: "#f472b6", style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 700, color: "#f472b6", letterSpacing: 0, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 }, effects: [{ id: newId("fx"), type: "slide", startTime: 0.25, duration: 0.5, easing: "ease-out", from: { opacity: 0, x: -50 }, targets: { opacity: 1, x: 0 } }] },
  { id: newId("comp"), startIndex: 15, endIndex: 20, color: "#a78bfa", style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 700, color: "#a78bfa", letterSpacing: 0, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 }, effects: [{ id: newId("fx"), type: "slide", startTime: 0.5, duration: 0.5, easing: "ease-out", from: { opacity: 0, x: -50 }, targets: { opacity: 1, x: 0 } }] },
], 3);

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
          initial={{ opacity: 0, scale: 0, x: `${s.x}%`, y: `${s.y}%` }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.5] }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            repeatDelay: Math.random() * 2,
            ease: "easeInOut",
          }}
          style={{ width: s.size, height: s.size }}
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
const particleProj = makeMiniProject("Sprinkle magic.", [{
  id: newId("comp"), startIndex: 9, endIndex: 15, color: "#fbbf24",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 800, color: "#fbbf24", letterSpacing: -1, alignment: "center", x: 0, y: 0, opacity: 1, scale: 1, rotation: 0, blur: 0 },
  effects: [
    { id: newId("fx"), type: "zoom", startTime: 0, duration: 0.5, easing: "ease-out", from: { scale: 0.8, opacity: 0 }, targets: { scale: 1, opacity: 1 } },
    { id: newId("fx"), type: "particle", startTime: 0, duration: 2, easing: "linear", targets: {}, particle: { density: 18, size: 14, color: "#fbbf24", preset: "gold", shape: "star", type: "standard", mode: "around", rangePx: 40, continueAfter: false } },
  ],
}]);

/* ---- 14. Fireworks launch ---- */
function FireworksHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fwRef = useRef<Fireworks | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.parentElement?.clientWidth ?? 300;
    canvas.height = 160;
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
    return () => {
      fw.stop(true);
      fwRef.current = null;
    };
  }, []);
  return (
    <div className="relative">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <h3 className="text-3xl font-bold tracking-tight sm:text-4xl relative z-10">
        <motion.span
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          style={{ display: "inline-block", color: "#f87171" }}
        >Celebrate!</motion.span>
      </h3>
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
const fireworksProj = makeMiniProject("Celebrate!", [{
  id: newId("comp"), startIndex: 0, endIndex: 10, color: "#f87171",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 800, color: "#f87171", letterSpacing: -1, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 },
  effects: [
    { id: newId("fx"), type: "slide", startTime: 0, duration: 0.6, easing: "ease-out", from: { opacity: 0, y: 100 }, targets: { opacity: 1, y: 0 } },
    { id: newId("fx"), type: "fireworks-js", startTime: 0.5, duration: 2.5, easing: "linear", targets: {}, fireworks: { density: 60, explosion: 6, gravity: 1.5, opacity: 0.6, flickering: 50, acceleration: 1.05, friction: 0.97, traceLength: 3, traceSpeed: 10, intensity: 35, lineStyle: "round", mode: "around", spreadRadius: 200, delayMin: 80, delayMax: 300, brightnessMin: 50, brightnessMax: 80, decayMin: 0.015, decayMax: 0.03, hueMin: 0, hueMax: 30, continueAfter: false } },
  ],
}], 3.5);

/* ---- 15. Double zoom ---- */
function DoubleZoomHero() {
  return (
    <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
      <motion.span
        initial={{ opacity: 0, scale: 0.3, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ display: "inline-block" }}
      >Pop out!</motion.span>
    </h3>
  );
}
const DOUBLE_ZOOM_CODE = `import { motion } from "motion/react";
export function Hero() {
  return (
    <h1>
      <motion.span
        initial={{ opacity: 0, scale: 0.3, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ display: "inline-block" }}
      >Pop out!</motion.span>
    </h1>
  );
}`;
const doubleZoomProj = makeMiniProject("Pop out!", [{
  id: newId("comp"), startIndex: 0, endIndex: 8, color: "#c084fc",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 800, color: "#c084fc", letterSpacing: -1, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "zoom", startTime: 0, duration: 0.5, easing: "ease-out", from: { scale: 0.3, opacity: 0, y: -60 }, targets: { scale: 1, opacity: 1, y: 0 } }],
}]);

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
const letterSpacingProj = makeMiniProject("Stretch", [{
  id: newId("comp"), startIndex: 0, endIndex: 7, color: "#34d399",
  style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 72, fontWeight: 800, color: "#fafafa", letterSpacing: -1, alignment: "center", x: 0, y: 0, opacity: 0, scale: 1, rotation: 0, blur: 0 },
  effects: [{ id: newId("fx"), type: "fade", startTime: 0, duration: 0.6, easing: "ease-out", targets: { opacity: 1 }, staggerLetters: true, staggerDelay: 0.04 }],
}]);

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
