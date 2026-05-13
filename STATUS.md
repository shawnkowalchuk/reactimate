# reactimate — Status

> Living doc. Updated whenever a feature ships. Pair with [README.md](./README.md) for usage and setup.

**Last updated:** 2026-05-13 · commit [`0eeb993`](https://github.com/shawnkowalchuk/reactimate/commit/0eeb993) + public marketing site (this commit)

---

## What works today

### Routing
- `react-router-dom` v7. `/` → `HomePage` (public marketing site), `/app` → `EditorPage` (the animator). Catch-all routes back to `/`
- `AuthGate` now wraps only `/app` — when Supabase auth is configured and the user isn't signed in, the editor route redirects to `SignInScreen`; the public home stays accessible without auth
- App entry: `main.tsx` mounts `<BrowserRouter>` with the route table; `themeStore` is imported for its side effect (applies `dark` class before first paint)

### Public home page (`/`)
- `pages/HomePage.tsx` composes: `Navbar` · `Hero` · `HowItWorks` · `Examples` · `Features` · `CallToAction` · `Footer`
- **Navbar** (sticky, blurred): logo · in-page anchors · GitHub link · theme toggle · `Sign in` (only when `isAuthEnabled` and user is null, opens `SignInScreen` in a backdrop modal) · primary CTA (`Continue editing` when signed in, otherwise `Open editor`) → `/app`
- **Hero**: title with three live `motion/react` words animating in on mount (per-word fade, slide, scale); body copy; primary CTA + GitHub link
- **How it works**: 4-step explainer (Type → Componentize → Animate → Export) with lucide icons and numbered chips
- **Examples**: 4 live animated heroes rendered as real `motion/react` JSX (Welcome stagger fade, Slide + color shift, Typewriter, Pop + scale bounce). Each card has its own background color (dark/light/navy/cream) so the visual matches the target site style; tabs flip between **Preview** (live animation) and **Code** (the JSX you'd export, with a **Copy** button). All examples loop on a shared 5s timer; a per-card **Replay** button forces a fresh mount
  - `components/home/MotionExample.tsx` is the reusable card; example contents are hand-written snippets in `components/home/Examples.tsx` matching the exact shape `export/generateComponent.ts` produces
- **Features**: 8 bullets (visual + code side-by-side, advanced effects, per-component style, clean exported JSX, autosave, undo/redo + loop, Supabase auth, self-contained output)
- **CallToAction**: large "Open the editor" CTA
- **Footer**: GitHub / Status / MIT links
- Theme: same `themeStore` + `dark:` Tailwind variants — the home page respects the persisted theme

### Editor shell
- Four-row layout: **Toolbar** · **InspectorBar** (top, always shown) · **Editor / Preview** main grid · **Timeline** footer (`grid-rows-[auto_auto_40vh_minmax(0,1fr)]`)
- Toolbar: name, time slider, undo/redo, transport (skip-back / play-pause / **loop**), **theme toggle (sun/moon)**, save / load / reset, export
- Tabbed preview pane (live animation / live generated JSX). The preview stays mounted under the Code tab so animation engine refs don't churn
- **Light/dark theme** for the app chrome — Tailwind `darkMode: 'class'` driven by `themeStore` (persisted as `reactimate.theme`); `applyThemeClass` runs at module load before React mounts so the first paint matches the saved preference
- Optional `UserMenu` (avatar + email + sign-out) when Supabase auth is enabled

### InspectorBar (top of app)
- **Project row** (always visible): editable `Name` / `Duration` / `Canvas` preset (16:9 · 1:1 · 9:16 · **Custom**) + `W × H` inputs (aspect-locked to the preset, free in `Custom` mode) / `Bg` (picker + hex/HSL text) / `Text` color (default text color) / Quick **Dark site** + **Light site** preset buttons that set bg + default text and rewrite any component whose color matched the prior default
- **Component row** (appears when a component OR one of its effects is selected — so context stays visible while the EffectModal is open): inline **FontPicker** (custom picker, 26 Google Fonts grouped by category, each option rendered in its own family), `Weight`, `Size`, `Color`, **L/C/R alignment** (per-component), **Remove**

### Text editor + componentize flow (Phase 3 + Phase 4)
- `components/editor/TextEditor.tsx` — `contenteditable` rendered inside a scaled mini-canvas matching the preview (same width, height, background, centered both axes; uses `canvasScaleStore` to stay in sync with the preview pane)
  - Does NOT render `layer.text` as JSX children (that fights React reconciliation against the browser's input and collapses the caret to position 0 on every keystroke). The DOM text is mutated only by a `useLayoutEffect` that writes when `layer.text` diverged from `el.textContent` (undo, file load, reset)
  - Maintains a single text node so `Selection.startOffset` is directly the character offset in `layer.text`. If the browser inserts foreign nodes (`<br>`, `<div>`) on paste, `onInput` re-flattens and restores the caret
  - **Multi-line:** `beforeinput insertParagraph` / `insertLineBreak` and `paste` are intercepted; text is inserted via a manual Range-based helper (`execCommand('insertText','\n')` is unreliable across browsers). Newlines flow through `diffStrings → adjustRanges → store` like any other character
  - `onInput` runs `diffStrings(old, new)` → `updateLayerText(newText, editStart, editEnd, newLength)` which pipes through `engine/ranges.adjustRanges` to keep component ranges consistent
- `utils/textDiff.ts` — minimal-edit detector via longest common prefix + non-overlapping common suffix (13 tests)
- `components/editor/ComponentOverlay.tsx` — outlined boxes around componentized ranges + a 32px **click-to-select circle** on the top-right of each box (uses the largest rect so it lands on the visible word, not a leading-whitespace fragment); area-based overlap detection so adjacent same-line components don't stack spuriously; duplicates stack diagonally. The overlay sits OUTSIDE the scaled canvas frame so its rect math runs in viewport pixels (boxes/dots don't shrink with scale)
- `components/editor/EditorActions.tsx` — three-button toolbar on the editor row (replaces the floating popover + dialog removed in `128e0e7`):
  - **+ Componentize** — enabled when the selection doesn't overlap any component
  - **Split** — enabled when selection is fully inside one component
  - **Merge N** — enabled when selection fully covers 2+ components
  - Disabled buttons show a why-not tooltip
- `components/editor/useTextSelectionMode.ts` — pure hook that reads the live `Selection` and returns one of `{ kind: "componentize" | "split" | "merge", … }` or `null`
- 26 curated Google Fonts loaded statically from `index.html` (Inter, Manrope, Space Grotesk, Plus Jakarta Sans, Outfit, DM Sans, Fraunces, Playfair Display, Bricolage Grotesque, JetBrains Mono, Anton, Archivo Black, Bebas Neue, Caveat, EB Garamond, Fira Code, Geist, Geist Mono, Karla, Lora, Merriweather, Onest, Oswald, Pacifico, Roboto Slab, Sora) with `display=swap`
- Exported `Hero.jsx` uses `whiteSpace: "pre-wrap"` on the inner `<div>` so `\n` characters render as visible line breaks

### Animation engine (pure logic + tested)
| Module | Purpose |
| ------ | ------- |
| `types/project.ts` | `Project`, `Layer`, `Component`, `Effect`, `ComponentStyle`, `ComputedStyle`, `EasingType`, `EffectType` (incl. `spotlight`/`sparkle`/`typewriter`/`custom`), spotlight/sparkle/typewriter config blocks, `staggerLetters` / `staggerDelay` / `staggerDirection`, optional per-effect `from` |
| `engine/easing.ts` | `linear`, `ease-in`, `ease-out`, `ease-in-out`, `spring`, `bounce` |
| `engine/interpolate.ts` | `lerp`, `lerpColor`, `lerpProperty` |
| `engine/ranges.ts` | `adjustRanges`: text-edit → component-index fixup; `rangeOverlapsAny` |
| `engine/palette.ts` | `nextColor` for new components |
| `engine/compose.ts` | `computeComponentStyle(component, time, letterIndex?)` |

**Compose semantics (current):**
- Each effect can declare an explicit per-prop `from` value; if absent, the engine falls back to the previous effect's target (or `component.style` for the first effect)
- `staggerLetters` shifts each letter's per-effect window by `staggerDelay * letterIndex`. `staggerDirection: 'reverse'` animates the last letter first
- `typewriter` auto-derives the per-letter delay from `duration / letterCount`. `typewriter.mode === 'snap'` collapses each letter's window to ~1ms so it flips instantly; `'fade'` uses the effect's normal duration per letter
- **Visibility window**: a component is forced to `opacity = 0` outside any of its effects' `[start, end]` ranges. Typewriter and rotate effects keep the text visible AFTER they finish (the letter stays typed). Sparkle effects with `continueAfter: true` also stay active past their end. If the component is active but no effect on it touches opacity, baseline opacity is forced to 1 so the user doesn't accidentally render an invisible component
- Empty-effects components are hidden entirely

### Playback
- `playback/useAnimationEngine.ts` — `requestAnimationFrame` loop, direct DOM writes via component refs (no per-frame React re-render). Each component span can be registered either as one ref per component or one-per-letter (`${componentId}|${letterIndex}`) for stagger / typewriter effects
- Play / pause (toolbar button or **Space**) · `Home` jumps to `t=0`
- **Loop / continuous play** toggle in the toolbar — when on, the RAF loop wraps `t` back to ~0 (carrying any overflow so short durations don't drop a frame) instead of stopping at the end. Persisted in `localStorage` (`reactimate.loop`)
- Auto-rewinds when Play is pressed at the end
- Scrub via toolbar slider OR dragging the playhead on the timeline

### Timeline UI (Phase 7)
- Time ruler with auto-spaced tick marks; click to seek
- One row per component, color-coded
- Effect blocks: drag body to move, drag edges to resize (50ms snap; **Shift** disables snap), **Pencil** icon opens the EffectModal, **X** icon deletes the effect
- **+** button on each row's gutter chip adds a blank `(no effect)` placeholder at the current playhead (no popup; replaced the earlier dropdown). User picks the actual type inside the EffectModal
- **Duplicate** (Copy icon) next to **+** appends a copy of the component's text to the end of the layer text (separated by a space) and creates a new component over that range with the same style and a fresh copy of the effects (new ids)
- Click gutter chip → selects the component
- Trackpad/wheel scroll is contained inside the timeline and slowed to 35% of native deltaY so a single swipe doesn't fly past dozens of rows
- Draggable playhead synced to `currentTime`

### EffectModal (uiStore-driven)
- `store/uiStore.ts` exposes `effectModal: { componentId, effectId } | null`. Decoupled from `selectionStore` so selection ≠ modal-open
- **Type dropdown** ("(no effect) / Fade / Slide / Scale / Rotate / Color shift / Spotlight / Sparkle / Typewriter") — switching type seeds the new type's defaults and clears stale type-specific config blocks
- `Start` and `Duration` number inputs
- **EasingPicker** — SVG curve graphs in a grid (linear, ease-in, ease-out, ease-in-out, spring, bounce); replaces the easing dropdown
- **Per-prop Start → End editors** for each animated property (opacity, x, y, scale, rotation, color, fontSize) — explicit `from` + `to`
- Type-specific config:
  - Spotlight: shape (circle/square), size, color, opacity, motion mode, mask + maskMode + feather + backdrop toggle
  - Sparkle: density, size, color/preset, particle type (Standard / Fireworks / Volcano / Dropping via **SparkleTypePicker**), mode (component / around / follow / hover), rangePx, spawnRadiusPx, lifespanSec, sizeJitter, rotationSpeed, continueAfter
  - Typewriter: mode (snap / fade)
- **Preset save/load bar** at the top:
  - `store/presetStore.ts` — `LocalStorageBackend` keeps presets in `reactimate.presets.v1`; the `PresetStorage` interface is set up so a future Postgres/REST backend can drop in
  - Save current effect as preset (name)
  - Apply a saved preset (replaces type + config + targets/from on the open effect)
  - Import / Export individual preset as JSON

### Preview rendering
- `components/preview/PreviewCanvas.tsx` — frames the design canvas at true dimensions, scales to fit via CSS transform + `canvasScaleStore`; shows live zoom %, dimensions, preset
- `components/preview/RenderedText.tsx`:
  - Splits layer text into plain + componentized segments, sorted by `startIndex`
  - Plain non-whitespace text is **not rendered** in the preview (only componentized text appears) — plain whitespace between components is rendered invisibly to preserve spacing
  - Per-letter rendering kicks in when any effect on the component has `staggerLetters` or is `typewriter`; each letter is its own registered span keyed `${componentId}|${i}`
  - Wraps componentized segments in a **TintWrapper** when any active spotlight effect has `maskText`, layering `SpotlightOverlay`, `TintLayer`, and `SparkleOverlay` as needed
  - Max text width capped at 55% of canvas width for natural wrap
- `components/preview/SpotlightOverlay.tsx` — colored backdrop shape (circle/square) that follows mouse / sweep-left / sweep-right; soft feather; optional backdrop toggle
- `components/preview/SparkleOverlay.tsx` — particle engine with four physics modes (Standard, Fireworks, Volcano, Dropping) and four spawn modes (component / around / follow / hover); per-sparkle lifetime, jitter, rotation
- `components/preview/TintLayer.tsx` — masks the owning component's text so spotlight `tint` or `reveal` modes recolor only the beam's intersection
- `store/spotlightStore.ts` — mouse position relative to the preview canvas, fed to spotlight `motion: "mouse"` effects
- `store/canvasScaleStore.ts` — shared scale + position between editor mini-canvas and preview canvas so overlays measure correctly

### Export to Motion JSX (Phase 8)
- `export/generateComponent.ts` — `Project` → self-contained `Hero.jsx` string using `motion/react`
- `export/effectToMotion.ts` — smart per-property motion props
  - Single-effect: `{ delay, duration, ease }`
  - Multi-effect on the same property: keyframe array with `times` and per-segment `ease` array
  - Identical per-prop transitions consolidate into one shared transition
  - `rotation` → `rotate` rename for Motion
  - Color is moved out of `style` and into `initial`/`animate` only when it's animated
- `export/format.ts` — idiomatic JS-source formatter (unquoted identifier keys, double-quoted strings, inline-or-expand by length, 6-decimal float rounding)
- `export/easingMap.ts` — our `EasingType` → Motion ease names (`spring`/`bounce` approximate to `easeOut`/`backOut`)
- Toolbar **Export** button downloads `<slug>.jsx`
- Code tab **Copy** button (clipboard API + select-all fallback)
- Heads-up: the new effect types (spotlight, sparkle, typewriter) are visible in the editor preview but the exporter currently only emits the standard CSS-property animations — exporting spotlight/sparkle/typewriter as real Motion JSX is on the backlog

### Persistence (Phase 9)
- `persistence/localStorage.ts` — schema-versioned save/load with `validateProject` runtime gate
- `persistence/useAutosave.ts` — 400ms debounced project-store subscription
- `persistence/importExport.ts` — `.json` save (download) and load (file picker + validate)
- Toolbar **Reset-to-sample** with confirm dialog (also clears local storage + temporal stack)
- `store/presetStore.ts` (above) — separate localStorage key, separate from the project blob

### Undo / redo
- `zundo` `temporal` middleware on `projectStore`
- **Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y** keyboard shortcuts (ignore when focus is in an `input`/`textarea`/`contenteditable`)
- Undo / Redo buttons in toolbar

### Optional auth (Supabase)
- Env-gated: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Unset → app runs as before; auth code never activates
- `auth/AuthGate.tsx` wraps the app; shows `SignInScreen` when enabled and unauthenticated
- `auth/SignInScreen.tsx` — email/password sign-in **and** sign-up (with email verification) **and** magic-link, plus Google + Apple OAuth buttons
- `auth/useAuth.ts` — `{ isLoading, user, session }`, subscribed to `onAuthStateChange`
- `signOut()` exported alongside

### Tooling & quality
- Vite 6 + React 19 + TypeScript (strict) + Tailwind v3 (`darkMode: 'class'`)
- ESLint flat config + Prettier
- **96 tests passing** across 10 files: ranges (15), compose (9 — updated for new visibility model), interpolate (11), palette (3), format (10), effectToMotion (7), generateComponent (9), localStorage (11), textDiff (13), projectStore split/merge (8)
- GitHub Actions CI: `lint` → `typecheck` → `test` → `build`
- Conventional commits; commit log is the design record

---

## Not implemented yet

### Export the new effect types
**Status:** not started. **Effort:** medium.
`spotlight`, `sparkle`, and `typewriter` show up correctly in the editor preview but the `Hero.jsx` exporter only emits the core CSS-property motion props. Real Motion JSX for these probably means:
- Spotlight → a separate `<motion.div>` sibling with `framer-motion` `useMousePosition` (mouse) or a `transition` keyframe sweep, plus a CSS `mix-blend-mode` or `mask-image` to mask the text
- Sparkle → a child `<motion.div>` particle field using `AnimatePresence` + a generator
- Typewriter → an array of `<motion.span>` per letter with staggered `transition.delay`

### Cloud project storage
**Status:** not started, **depends on:** Supabase auth being on. **Effort:** ~2–3h.
Even when signed in, projects stay in `localStorage` per browser. To make projects follow the user across devices:
- Supabase table `projects` ( `id uuid pk`, `user_id uuid references auth.users`, `name text`, `data jsonb`, `updated_at timestamptz` )
- RLS policy: `auth.uid() = user_id` for select/insert/update/delete
- Replace `useAutosave` to upsert to Supabase when auth is enabled and authenticated; fall back to `localStorage` otherwise
- New-project / "Save as new" / project list picker
- Initial load: fetch the user's most-recent project, or seed with the sample on first sign-in
- Presets could optionally migrate from `LocalStorageBackend` to a `PostgresBackend` via the existing `PresetStorage` interface

### Phase 2 — layout polish
**Status:** mostly done via the editor/inspector overhaul. Remaining: better empty/error states, breakpoint behavior, a polish pass on spacing/typography. Probably "read-only on mobile" rather than building a real touch editor.

### Known editor quirk: cursor past a trailing `\n`
**Effort:** small, low priority.
If the user presses Enter at the very end of the text and then types, the new text lands BEFORE the trailing `\n` (browser-level quirk — `execCommand('insertText')` and native typing both visually treat "after \n at end of node" the same as "at end of previous line"). The text and exported JSX are both fine; only the caret position is unintuitive in that one edge case. Workarounds: don't allow trailing newlines (auto-trim), or replace `\n` with `<br>` elements (bigger refactor, breaks the single-text-node selection model).

### Phase 9 backlog (polish)
- More effects: `blur`, letter-spacing animation, masked text reveal (other than spotlight), shake, glitch
- Templates / starter projects (curated `Project[]` users can clone — could ship as importable JSON via existing load flow)
- Keyboard nudge (arrow keys when an effect block is selected: ±50ms move, with Shift = bigger step)
- Onboarding tooltips for first-time users
- Cubic-bezier easing curve editor in the EasingPicker (currently 6 named presets)
- Compact toolbar when narrow
- Tests for the new effect types (sparkle / spotlight physics, typewriter timing)

### Far horizon
- Multi-line text / multiple stacked layers
- Image / shape / video layers
- Export to other formats: Lottie, MP4, GIF
- Real mobile editor — currently expected to be desktop-only
- Templates marketplace
- Collaboration / multi-cursor

---

## How this file is maintained

Whenever a chunk of work ships to `main`:
1. Move the affected items from "Not implemented yet" into "What works today" with a one-line description.
2. Update the **Last updated** header at the top with today's date and the new head commit short SHA.
3. If the work surfaced new follow-ups, add them to "Not implemented yet" — keep it honest, not aspirational.

The README has a brief at-a-glance roadmap table; this file is the deeper truth.
