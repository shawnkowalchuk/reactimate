# reactimate — Status

> Living doc. Updated whenever a feature ships. Pair with [README.md](./README.md) for usage and setup.

**Last updated:** 2026-05-12 · commit [`91ab8bb`](https://github.com/shawnkowalchuk/reactimate/commit/91ab8bb) + Add-effect UI & component style inspector (this commit)

---

## What works today

### Editor shell
- Three-pane layout: editor (top-left) · preview/code (top-right) · timeline (full-width footer)
- Tabbed preview pane: live animation **or** live generated JSX
- Toolbar: project name, time display, scrubber, undo/redo, transport (skip-back / play-pause), save / load / reset, export
- Optional `UserMenu` (avatar + email + sign-out) when Supabase auth is enabled

### Text editor + componentize flow (Phase 3 + Phase 4)
- `components/editor/TextEditor.tsx` — single-line `contenteditable` div bound to `layer.text`
  - React only writes to the DOM when the text changes from an EXTERNAL source (undo, file load, reset) so the cursor isn't disturbed during typing
  - `beforeinput` blocks line breaks (Enter, paste of multi-line text is collapsed to spaces)
  - `onInput` runs `diffStrings(old, new)` → calls `projectStore.updateLayerText(newText, editStart, editEnd, newLength)` which pipes through `engine/ranges.adjustRanges` to keep component ranges consistent
- `utils/textDiff.ts` — minimal-edit detector via longest common prefix + non-overlapping common suffix; tested for inserts, deletes, replaces, select-all, paste-at-start, append, clear, and round-trip reconstruction
- `components/editor/ComponentOverlay.tsx` — colored highlight boxes drawn on a separate absolutely-positioned layer using `Range.getClientRects()` (so word-wrap is handled correctly); recomputes on resize, component/text change, and `document.fonts.ready`
- `components/editor/SelectionPopover.tsx` — floating **+ Componentize** button appears when there's a non-empty selection inside the editor that doesn't overlap an existing component; hidden during the dialog
- `components/editor/CreateComponentDialog.tsx` — modal with font (curated Google Fonts), weight, size, color picker (hex + native `input[type=color]`); live style preview; calls `addComponent(start, end, partialStyle)`
- 10 curated Google Fonts loaded statically from `index.html` (`display=swap`)

### Animation engine (pure logic + tested)
| Module | Purpose |
| ------ | ------- |
| `types/project.ts` | `Project`, `Layer`, `Component`, `Effect`, `ComponentStyle`, `ComputedStyle`, `EasingType`, `EffectType` |
| `engine/easing.ts` | `linear`, `ease-in`, `ease-out`, `ease-in-out`, `spring`, `bounce` |
| `engine/interpolate.ts` | `lerp`, `lerpColor`, `lerpProperty` |
| `engine/ranges.ts` | `adjustRanges`: text-edit → component-index fixup; `rangeOverlapsAny` |
| `engine/palette.ts` | `nextColor` for new components |
| `engine/compose.ts` | `computeComponentStyle(component, time)` — "last completed value wins" semantics |

### Playback
- `playback/useAnimationEngine.ts` — `requestAnimationFrame` loop, direct DOM writes via component refs (no per-frame React re-render)
- Play / pause (toolbar button or **Space**)
- Scrub via toolbar slider **or** dragging the playhead on the timeline
- **Home** jumps to `t=0`
- Auto-rewinds when Play is pressed at the end

### Timeline UI (Phase 7)
- Time ruler with auto-spaced tick marks; click to seek
- One row per component, color-coded to match its UI box color
- Effect blocks per row:
  - drag body → move `startTime`
  - drag left edge → change `startTime` + `duration` (right edge stays fixed)
  - drag right edge → change `duration` only
  - 50ms snap grid by default; hold **Shift** to disable
- Click block to select; inspector strip below shows editable `Start` / `Dur` / `Easing` / animated props / **Delete**
- **Add-effect menu** (`+` button on each row's gutter chip): dropdown of `Fade` / `Slide` / `Scale` / `Rotate` / `Color shift` — adds at the current playhead time (clamped so the effect fits inside the project duration), then auto-selects the new effect so it opens straight in the inspector
- Click gutter chip → selects the component (`selectComponent`); the chip's color dot gets a sky-300 ring so the selection is unambiguous
- Inspector strip is context-sensitive:
  - **Effect selected** → `Start` / `Dur` / `Easing` / animated-prop list / Delete
  - **Component selected** → `Font` / `Wt` / `Size` / `Color` (hex picker + text) / Remove component (via `updateComponentStyle` + `removeComponent`)
  - **Nothing selected** → hint
- Draggable playhead synced to `currentTime`

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

### Persistence (Phase 9)
- `persistence/localStorage.ts` — schema-versioned save/load with `validateProject` runtime gate
- `persistence/useAutosave.ts` — 400ms debounced project-store subscription
- `persistence/importExport.ts` — `.json` save (download) and load (file picker + validate)
- Toolbar **Reset-to-sample** with confirm dialog (also clears local storage + temporal stack)

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
- Vite 6 + React 19 + TypeScript (strict) + Tailwind v3
- ESLint flat config + Prettier
- **88 tests passing** across 9 files: ranges (15), compose (9), interpolate (11), palette (3), format (10), effectToMotion (7), generateComponent (9), localStorage (11), textDiff (13)
- GitHub Actions CI: `lint` → `typecheck` → `test` → `build`
- Conventional commits; commit log is the design record

---

## Not implemented yet

### Phase 2 — layout polish
**Status:** not started. **Effort:** ~1h.
Mostly visual refinement of the three-pane shell — better empty/error states, breakpoint behavior, a polish pass on spacing/typography. Probably "read-only on mobile" rather than building a real touch editor.


### Cloud project storage
**Status:** not started, **depends on:** Supabase auth being on. **Effort:** ~2–3h.
Currently even when signed in, projects stay in `localStorage` per browser. To make projects follow the user across devices:
- Supabase table `projects` ( `id uuid pk`, `user_id uuid references auth.users`, `name text`, `data jsonb`, `updated_at timestamptz` )
- RLS policy: `auth.uid() = user_id` for select/insert/update/delete
- Replace `useAutosave` to upsert to Supabase when auth is enabled and authenticated; fall back to `localStorage` otherwise
- New-project / "Save as new" / project list picker
- Initial load: fetch the user's most-recent project, or seed with the sample on first sign-in

### Phase 9 backlog (polish)
- More effects: `blur`, letter-spacing animation, masked text reveal
- Per-letter splitting within a component (currently each component is one rendered span)
- Templates / starter projects (a curated `Project[]` users can clone)
- Keyboard nudge (arrow keys when an effect block is selected: ±50ms move, with Shift = bigger step)
- Onboarding tooltips for first-time users
- Cubic-bezier easing curve editor in the inspector
- Compact toolbar when narrow

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
