# reactimate — agent memory

Living guide for working in this repo. Read STATUS.md for the full feature inventory; this file is for repeated mistakes and conventions Claude has tripped on.

---

## Building "Open in Editor" example projects (`src/components/home/Examples.tsx`)

Every example on the homepage Examples carousel has both a **demo Hero** (decorative React/Motion JSX rendered in the small card) and a **canonical project** (`*Proj`) that opens in the editor when the user clicks "Editor". The project must be the structure a user would have built by hand. Use `buildExample(text, defaultStyle, duration, animated[])` for every project — never hand-roll a `Component[]`.

### Architectural rule the engine enforces

**Visible = componentized.** Plain (un-componentized) text is intentionally hidden by `RenderedText.tsx` (only plain whitespace is rendered as `visibility:hidden`). If you want text to appear in the preview, it must live on a component. There is NO rendering of plain text — do not propose adding one. The user has explicitly rejected that change.

A component is only visible when at least one of its effects' `[startTime, endTime]` window is active at the current playback time. Outside any active window, `compose.ts` forces `opacity = 0` (with exceptions for `typewriter`, `rotate`, and `particle` with `continueAfter`). So:

- **Static text** needs a `custom` ("(no effect)") block spanning `[0, projectDuration]` so it's visible the whole time AND surfaces as a row on the timeline.
- **Animated text** that animates from `t=startTime` to `t=startTime+duration` needs a trailing `custom` block from `[startTime+duration, projectDuration]`. Without it, the headline disappears the moment the animation ends.

`makeWordComponents` handles both automatically. Don't bypass it.

### Required structure for each example

For each visible chunk of the demo text:

| Demo's intent | Project structure |
|---|---|
| Whole text animated as ONE motion.span | ONE animated component covering all words in the range |
| Multiple separate motion.spans (e.g. cascade) | One animated component per span |
| Mix of static + animated (e.g. "The new way to **animate.**") | Per-word components: static words get auto-emitted `(no effect)` blocks; animated word(s) get the effect |
| Text that uses a feature outside the project model (typewriter cursor blinker, decorative floating divs) | Skip that decoration — it's a marketing-card flourish, not part of the project. The editor preview will be structurally identical, not pixel-identical. |

### Helper API

```ts
buildExample(
  text: string,
  defaultStyle: ComponentStyle,    // spread BASE_STYLE + per-example overrides
  duration: number,                // project duration (seconds)
  animated: AnimatedRange[],       // [{ range: [start,end), color, styleOverride?, effects[] }]
): Project
```

`makeWordComponents` (called inside `buildExample`):
- Tokenizes `text` on whitespace (`/\S+/g`).
- For each word NOT contained in any `animated` range → emits a static component with one `custom` effect at `[0, duration]`.
- For each animated range → emits one component covering exactly that range with `effects` PLUS an auto-bridge `custom` effect from `latestEffectEnd → duration` (if there's a gap).
- Sorts by `startIndex` so timeline reading order matches text order.

### Things to remember

- `BASE_STYLE` is the shared template. Spread it + override only the differences (`fontWeight`, `letterSpacing`, `color`).
- A component's `color` field is the **timeline chip color**, NOT the rendered text color. Text color comes from `style.color`. For animated words you usually want `color: "#xyz"` (chip) AND `styleOverride: { color: "#xyz" }` (text).
- The animated effect's own `from.color` / `targets.color` overrides `style.color` during the animation — that's how color-shift works.
- `\n` in text is whitespace → not a word → preserved as plain whitespace, which `RenderedText` renders invisibly while `whiteSpace: pre-wrap` honors the line break. Test this by including a `\n` and confirming the preview wraps where expected.
- Don't word-split typewriter ranges. Typewriter is per-letter inside a single component — splitting it would break the per-letter staggering.
- Single-word demos (`bounceProj`, `fireworksProj`, etc.) still go through `buildExample` — pass an animated range covering the whole word.

### Verification per example

When you add or modify an example, mentally walk through:

1. Run `text.match(/\S+/g)` to enumerate words and their `[start, end)` ranges.
2. Check each animated range `[s, e]` covers the intended word(s) exactly (no off-by-one with the period or comma).
3. Compute `latestEnd = max(effect.startTime + effect.duration)` for each animated range — confirm the auto-bridge will produce a sensible trailing block (or none if it equals `duration`).
4. Open `https://reactimate.top/`, click "Editor" on the card, and verify:
   - Editor text matches the demo text exactly (incl. line breaks).
   - Timeline shows one row per word (static rows have grey "(no effect)" blocks; animated rows have colored effect blocks + a trailing grey block if the effect ends before project end).
   - Hit Play in the editor — only animated words animate; static + post-animation text stays visible to project end.

---

## General project conventions

- **Stack:** Vite 6 + React 19 + TypeScript (strict) + Tailwind 3 (`darkMode: 'class'`) + zustand + zundo (temporal middleware).
- **Backend:** env-gated Firebase (`VITE_FIREBASE_CONFIG` — one-line JSON of the web-app config). With env unset the app runs purely from `localStorage` — preserve that fallback path in any auth/persistence change. Auth = Firebase Auth (password, email link, Google, Apple); data = Firestore (`profiles`, `projects` id=uid, `presets`, `feedback` + `replies` subcollection) guarded by `firestore.rules`. Project/preset JSON blobs are stored as JSON **strings** (Firestore rejects nested arrays).
- **Routing:** `react-router-dom` v7. SPA — `firebase.json` rewrites `**` → `/index.html` so refreshes don't 404.
- **Hosting:** Firebase Hosting (Spark tier), project `reactimate-cloud`, production at `https://reactimate.top` (the similarly-named reactimate.cloud domain is unused and lapses 2027-05). SEO meta in `index.html`, `public/sitemap.xml`, `public/robots.txt`, `public/og-image.svg` all reference that exact URL — keep them in sync if the domain ever changes. Deploys: CI on push to main, or `firebase deploy --only hosting`.
- **Testing:** vitest, **124 tests passing across 12 files**. Run `npm test -- --run`. Don't merge a regression.
- **Commits:** conventional. After landing user-facing changes, commit + push to `origin/main` only when explicitly asked (the user often wants to test locally first).

## Particle / fireworks: `area` is canvas-design coords

Both effect types own an `EffectArea` rectangle (`x, y, width, height` in canvas DESIGN px). `ParticleOverlay` spawns within `area`; `FireworksLibraryOverlay` translates `area` into fireworks-js `boundaries` so rockets explode within it.

- `mode: "area"` is the default placement (replaces the old `"component"` / `"around"` modes).
- Particle keeps `mode: "follow"` (cursor anywhere) and `mode: "hover"` (cursor inside `area`).
- Fireworks has no `mode` field — area is always used.
- The user adjusts `area` via the **`EffectAreaOverlay`** drag UI on the preview, NOT a numeric input. Show a read-only summary in the EffectModal panel.
- Old projects (`mode: "component"`/`"around"` + `rangePx` / `spreadRadius`) auto-migrate to `area` in `validateProject`. Substitutes a sensible default rectangle since text bbox isn't measurable at load-time.
- Fireworks `followMouse` is wired to fireworks-js `mouse.click` — UI label is **"Click to launch"**.

## Things that have bitten Claude before

- **`fireworks-js` `stop(true)` removes the canvas from the DOM.** On React strict-mode re-mount the next `createCanvas` call sees `canvas.isConnected === false` and re-attaches the canvas to `document.body`, where `position: absolute; inset: 0` makes it span the entire viewport. Always use `fw.stop(false)`.
- **Motion's `x`/`y` percent values resolve to the element's OWN size**, not the parent's. Use CSS `left`/`top` percent on `style` for parent-relative positioning (e.g. ParticleBurstHero stars).
- **`canvas.parentElement.clientWidth` is NOT a reliable size source** when the parent shrinks to text content. For overlay canvases use the parent's `getBoundingClientRect()` synced via `ResizeObserver`.
- **SignInScreen's pending flag** is cleared on success ONLY because AuthGate unmounts it on `/app`. When hosted in a modal (Navbar), the host doesn't unmount, so `setPending(false)` must run on the success path defensively. Modals must also auto-close on auth via `useEffect(() => { if (user && open) close(); }, [user, open])`.

---

If a rule here is wrong, fix it — don't work around it.
