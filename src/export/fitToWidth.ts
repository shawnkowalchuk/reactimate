/**
 * The `<FitToWidth>` wrapper emitted around every exported hero.
 *
 * A project is authored against a fixed design canvas (e.g. 1200×675) and
 * everything downstream depends on that coordinate space: text is laid out
 * in design px, and the particle / fireworks / spotlight layers are
 * absolutely positioned in design coords. Emitting that fixed-size box
 * straight into a consumer's page meant a 1200px hero overflowed every
 * phone.
 *
 * A uniform `transform: scale()` is the only fix that preserves the
 * coordinate space — fluid font sizing would reflow the text and leave
 * every overlay layer pointing at the wrong pixels.
 *
 * The scale is capped at 1, so a container at or above the design width
 * renders byte-identically to the pre-wrapper output. Only narrower
 * containers change, and `maxWidth: width` keeps the outer box the same
 * size the bare hero div used to be — so whatever centering the consuming
 * page applied still applies.
 */
const FIT_TO_WIDTH_SOURCE = `// Renders the hero at its authored size, scaling down uniformly when the
// container is narrower than the design width. Scaling (rather than
// reflowing) keeps every absolutely-positioned layer — particles,
// fireworks, spotlights — aligned to the design coordinates they were
// authored in. Delete this wrapper to go back to a fixed-size hero.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function FitToWidth({ width, height, children }) {
  const ref = useRef(null);
  const [fit, setFit] = useState(1);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      // Never scale UP: a wide container renders the design at 1:1.
      if (w > 0) setFit(Math.min(1, w / width));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={ref} style={{ width: "100%", maxWidth: width, height: height * fit }}>
      <div
        style={{
          width: width,
          height: height,
          transformOrigin: "top left",
          transform: "scale(" + fit + ")",
        }}
      >
        {children}
      </div>
    </div>
  );
}`;

export function fitToWidthHelperSource(): string {
  return FIT_TO_WIDTH_SOURCE;
}

/**
 * React hooks the emitted helper depends on. The generator consolidates
 * every helper's hooks into ONE `import ... from "react"` line, so this
 * returns names rather than an import statement.
 */
export const FIT_TO_WIDTH_HOOKS = [
  "useEffect",
  "useLayoutEffect",
  "useRef",
  "useState",
] as const;
