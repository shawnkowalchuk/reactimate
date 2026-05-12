# reactimate — Status

> Living doc. Updated whenever a feature ships. Pair with [README.md](./README.md) for usage and setup.

**Last updated:** 2026-05-12 · commit [`5682dd8`](https://github.com/shawnkowalchuk/reactimate/commit/5682dd8)

---

## What works today

### Editor shell
- Three-pane layout: editor (top-left) · preview/code (top-right) · timeline (full-width footer)
- Tabbed preview pane: live animation **or** live generated JSX
- Toolbar: project name, time display, scrubber, undo/redo, transport (skip-back / play-pause), save / load / reset, export
- Optional `UserMenu` (avatar + email + sign-out) when Supabase auth is enabled

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
- **75 tests passing** across 8 files: ranges (15), compose (9), interpolate (11), palette (3), format (10), effectToMotion (7), generateComponent (9), localStorage (11)
- GitHub Actions CI: `lint` → `typecheck` → `test` → `build`
- Conventional commits; commit log is the design record

---

## Not implemented yet

### Phase 2 — layout polish
**Status:** not started. **Effort:** ~1h.
Mostly visual refinement of the three-pane shell — better empty/error states, breakpoint behavior, a polish pass on spacing/typography. Probably "read-only on mobile" rather than building a real touch editor.

### Phase 3 — text editor with overlay
**Status:** not started. **Effort:** the blueprint says 4–5h and warns "hardest UI piece — budget extra time."
Requires:
- `TextEditor.tsx` — `contenteditable` div bound to `layer.text`
- Detect input edits via `beforeinput`/`input`, compute character offsets, call `updateLayerText(newText, editStart, editEnd, newLength)`
- `ComponentOverlay.tsx` — absolute-positioned outlines on top of componentized ranges using `Range.getBoundingClientRect`, redrawn on every text/layout change
- Selection-to-character-offset helper using `Selection.modify` semantics (`selectionchange` event)

Until this lands the layer text and component ranges are pinned to the bundled sample project.

### Phase 4 — selection → create component
**Status:** not started. **Effort:** ~2h once Phase 3 is in.
- `SelectionPopover.tsx` floats next to a non-empty selection that doesn't overlap an existing component
- `CreateComponentDialog.tsx` collects font / size / weight / color
- On confirm, call `projectStore.addComponent(start, end, style)` (already implemented in the store, including overlap rejection and palette color)

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
