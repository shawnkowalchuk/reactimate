# reactimate — Status

> Living doc. Updated whenever a feature ships. Pair with [README.md](./README.md) for usage and setup.

**Last updated:** 2026-08-13 · adoption fixes (responsive export wrapper, visible-on-create components, preview empty-state hint) + admin user removal, unread-feedback badge, time-in-app tracking (see header commit)

---

## What works today

### Routing
- `react-router-dom` v7. Routes:
  - `/` → `HomePage` (public marketing site)
  - `/feedback` → `FeedbackPage` (public; signed-in users submit + read their threads; falls back to a GitHub-issues prompt when Firebase isn't configured)
  - `/settings` → `SettingsPage` (public route but renders a "sign in" card when not authenticated)
  - `/app` → `EditorPage` wrapped in `AuthGate`
  - `/admin`, `/admin/users`, `/admin/feedback`, `/admin/feedback/:id` → admin subpages wrapped in `AdminGate`
  - `*` → `HomePage`
- `AuthGate` wraps only `/app`; `AdminGate` wraps `/admin/*` and additionally requires `profiles.is_admin = true`
- `AdminSync` headless component mounts at app root to subscribe `useAdminStore` to Firebase auth changes
- App entry: `main.tsx` mounts `<BrowserRouter>` with the route table; `themeStore` is imported for its side effect (applies `dark` class before first paint)

### SEO
- Full meta tag suite in `index.html`: title, description, keywords, canonical (`https://reactimate.top/`), theme-color (per color-scheme), Open Graph (`og:type` / `og:url` / `og:title` / `og:description` / `og:image` / `og:locale`), Twitter card (`summary_large_image`), and a `robots` directive
- JSON-LD structured data (`SoftwareApplication` schema) so search engines understand the product
- `public/og-image.svg` — 1200×630 social-share card with the reactimate logo + tagline (referenced by `og:image` and `twitter:image`)
- `public/robots.txt` — allows `/` and `/feedback`, disallows `/app` and `/admin`, points to the sitemap
- `public/sitemap.xml` — lists `/` and `/feedback`
- `<noscript>` fallback inside `#root` with the pitch + GitHub link, so crawlers without JS still see meaningful content
- Per-route `document.title` updates via `useEffect` in `HomePage`, `FeedbackPage`, and the admin pages

### Feedback (`/feedback`)
- Public-facing route; the page renders for everyone (so anyone can find it from search), but submitting + reading threads requires sign-in
- When Firebase isn't configured: a callout points users to GitHub Issues
- When signed in:
  - **New feedback** form (Subject + Message, with length caps) → adds a doc to the `feedback` collection via `api/feedbackApi.ts.submitFeedback` (status/reply_count/timestamps seeded client-side with `serverTimestamp()`)
  - **Your previous feedback** list — collapsible threads (subject + status pill + reply count); expanding fetches the thread's `replies` subcollection and renders them in a sky-tinted "Admin reply" panel
- All queries use the Firebase web SDK; `firestore.rules` enforces who sees what (users only see their own; admins see everything). `listMyFeedback` uses the composite index (user_id, created_at desc)

### Admin backend (`/admin/*`, gated)
- `auth/AdminGate.tsx` — wraps every admin route. Behavior:
  - Firebase not configured → `SetupRequired` screen with the env-var + rules-deploy + console admin-promotion instructions
  - Loading → spinner
  - Signed-out → `SignInScreen`
  - Signed-in but `profile.is_admin = false` → `Forbidden` screen pointing at the Firestore console field to flip
  - Otherwise → renders children
- `pages/admin/AdminLayout.tsx` — sidebar nav (Dashboard / Users / Feedback) + footer with current admin email, "Editor" link back to `/app`, sign-out button
  - **Unread badge** on the Feedback link — amber pill counting threads with `status: "open"` (only admins can reply, so open == unread). Uses `getCountFromServer`, which bills ONE read no matter how many threads match, instead of `listAllFeedback`'s one-per-doc. Cached in `store/adminBadgeStore.ts` so the layout's re-mount-per-navigation costs one read per admin session; `AdminFeedbackDetail` calls `refresh()` after a reply or status change
- **Dashboard** (`/admin`) — 5 stat cards (total users, active users, **time in app**, cloud projects, avg effects/project) + signup sparkline, top effect types, feedback breakdown, and the 10 most-recent feedback rows
- **Users** (`/admin/users`) — searchable table over the `profiles` collection (email, joined date, last_seen, **time in app**, admin pill, remove button). `last_seen_at` is now actually populated — `ensureMyProfile` refreshes it on every sign-in/session restore, so the dashboard's active-user stats are real (they were always null under Supabase; the writer was dead code)
  - **Remove user** — `api/adminUserApi.ts.purgeUserData()` deletes the user's project, presets, and feedback threads (each thread's replies first — Firestore does NOT cascade into subcollections), then their profile **last**, because the rules guard every other delete with `targetIsProtected(uid)`, which reads that profile. Behind a blocking confirm dialog; not atomic, but a partial failure leaves the profile intact so the row stays listed and the purge can be retried
  - **Admin accounts are non-removable**, enforced in `firestore.rules` (`profiles` delete requires `resource.data.is_admin != true`, and `targetIsProtected()` shields an admin's projects/presets/feedback). `removalBlockedReason()` mirrors it client-side to disable the button — a courtesy, not the guarantee
  - **Their Auth login is NOT deleted.** That needs the server-side Admin SDK, which means Cloud Functions and the paid Blaze plan. A purged user who signs in again gets a fresh empty profile; the confirm dialog and the success notice both say so and point at Firebase console → Authentication
- **Feedback** (`/admin/feedback`) — list filtered by status (all/open/replied/closed); rows link to the detail page
- **Feedback detail** (`/admin/feedback/:id`) — full thread (subject + body + sender + status dropdown) plus existing replies and a Reply form. Posting a reply also flips the row's status to `replied`
- Admin state lives in `useAdminStore` (zustand): the user's profile is cached and refreshed on every auth state change
- **Time in app** — `persistence/useActiveTime.ts`, mounted on `EditorPage` (time spent building, not time reading the marketing page). Counts only while the tab is visible AND input was seen within 60s; without that idle gate a tab left open overnight would report eight hours and make the metric worthless. Time accrues in refs (never re-renders the host) and reaches Firestore only once ≥60s has built up, on a 5-min interval or on `visibilitychange`/`pagehide` — the same flush pattern the cloud save uses. Costs ~1-2 writes per session. No-ops entirely when auth is disabled, preserving the localStorage-only path. `computeStats` aggregates total / max / average, where the average is over users with ANY recorded time — averaging over all profiles would sag toward zero as signups grow and hide whether engaged users are engaging more

### Firestore schema (`firestore.rules` + `firestore.indexes.json`)
- `profiles/{uid}` — `email`, `is_admin`, `created_at`, `last_seen_at`, `active_seconds`. Created client-side by `ensureMyProfile()` on first sign-in (replaces the old Postgres trigger — no Cloud Functions needed, stays on the free Spark plan); `last_seen_at` refreshed every session. `active_seconds` accumulates via `increment()` so concurrent tabs can't clobber each other, and profiles predating the field read as 0. Rules allow a user to change only `last_seen_at` + `active_seconds` on their own doc — `is_admin` still can't be self-granted
- `projects/{uid}` — `user_id`, `name`, `data` (project JSON as a **string** — Firestore rejects nested arrays), `created_at`, `updated_at`. Doc id == uid keeps the one-project-per-user invariant
- `presets/{autoId}` — `user_id`, `name`, `effect_type`, `config` (JSON string), `created_at`
- `feedback/{autoId}` — `subject`, `body`, `status` ∈ {open, replied, closed}, plus denormalized `reply_count` / `last_reply_at` (the old SQL view, maintained atomically by the reply batch)
- `feedback/{id}/replies/{autoId}` — admin-authored replies
- **Security rules** (ported 1:1 from the old RLS policies):
  - users read their own docs; admins (`profiles.is_admin`, checked via `get()` in rules) read everything
  - profile create forces `is_admin: false`; updates may only touch `last_seen_at` — admin is granted ONLY by editing the doc in the Firebase console
  - only admins post replies / change feedback status; users only create feedback as themselves
- **Composite indexes**: feedback (user_id asc, created_at desc), presets (user_id asc, created_at asc)
- Deploy both with `firebase deploy --only firestore`

### Account settings (`/settings`)
- `pages/SettingsPage.tsx` — four cards stacked vertically: **Profile** (email / joined date / account id), **Sign-in methods**, **Change password**, **Account**
- **Profile** is read-only and pulls everything from the app-level `AuthUser` (adapted from the Firebase user)
- **Sign-in methods** lists Email & password, Google, Apple. Each row reads the user's `providerData`, shows a green "linked" pill + the provider's email if present, and offers:
  - **Link** for unlinked providers → `linkProvider(provider)` wraps `linkWithPopup()` — resolves in place (no redirect), then the list refreshes with a success message
  - **Unlink** for linked providers → calls `unlinkIdentityById(identity)`. The button is disabled (with a tooltip) when the user only has one identity, so they can't lock themselves out
  - The Email row is labeled "primary" and not actionable from this card — passwords are handled in the Change password card instead
- **Change password** card — new password + confirm, eye/eye-off toggles, ≥8 chars, live mismatch warning. Calls Firebase `updatePassword()`. Works as both "change" and "set a new password" (for users who signed up via OAuth and never had one). Firebase's "requires recent login" error is caught and mapped to a readable "sign out and back in" message
- **Account** card — Sign out button and a collapsible "Delete my account" disclosure that points the user to the Feedback page for now (no self-serve delete in v1; admin handles via the Firebase console)
- `api/identityApi.ts` — `getMyIdentities`, `linkProvider`, `unlinkIdentityById`, `updatePassword` wrappers plus `friendlyAuthError()` mapping Firebase error codes to human copy; all return typed values and throw `Error` with readable messages
- Identity linking works out of the box in Firebase — no dashboard toggle needed (the old Supabase "Manual Linking" requirement is gone)
- Settings link in the home Navbar (when signed in) and in the editor's UserMenu (gear icon)

### Public home page (`/`)
- `pages/HomePage.tsx` composes: `Navbar` · `Hero` · `HowItWorks` · `Examples` · `Integration` · `Features` · `FAQ` · `CallToAction` · `Footer`
- Cross-route anchor navigation: `useEffect` reads `location.hash` and scrolls the matching section into view (works from `/feedback`, `/settings`, etc.)
- **Navbar** (sticky, blurred): logo · in-page anchors (`/#how`, `/#examples`, `/#faq` via `<Link>` for cross-route support) · Feedback link · Settings (signed-in) · Admin (admins) · GitHub link · theme toggle · `Sign in` (only when `isAuthEnabled` and user is null, opens `SignInScreen` in a backdrop modal) · primary CTA (`Continue editing` when signed in, otherwise `Open editor`) → `/app`
- **Integration** section: 4-step guide (Export → Install Motion → Drop in → Import & render) with code snippet
- **FAQ** section: 9-item accordion (license, integration, frameworks, deps, customization, JSX vs Lottie, privacy, offline, bug reports)
- **Hero**: title with three live `motion/react` words animating in on mount (per-word fade, slide, scale); body copy; primary CTA + GitHub link
- **How it works**: 4-step explainer (Type → Componentize → Animate → Export) with lucide icons and numbered chips
- **Examples**: 4 live animated heroes rendered as real `motion/react` JSX (Welcome stagger fade, Slide + color shift, Typewriter, Pop + scale bounce). Each card has its own background color (dark/light/navy/cream) so the visual matches the target site style; tabs flip between **Preview** (live animation) and **Code** (the JSX you'd export, with a **Copy** button). All examples loop on a shared 5s timer; a per-card **Replay** button forces a fresh mount
  - `components/home/MotionExample.tsx` is the reusable card; example contents are hand-written snippets in `components/home/Examples.tsx` matching the exact shape `export/generateComponent.ts` produces
- **Features**: 8 bullets (visual + code side-by-side, advanced effects, per-component style, clean exported JSX, autosave, undo/redo + loop, Firebase auth, self-contained output)
- **CallToAction**: large "Open the editor" CTA
- **Footer**: GitHub / Status / MIT links
- Theme: same `themeStore` + `dark:` Tailwind variants — the home page respects the persisted theme

### Editor shell
- Four-row layout: **Toolbar** · **InspectorBar** (top, always shown) · **Editor / Preview** main grid · **Timeline** footer (`grid-rows-[auto_auto_40vh_minmax(0,1fr)]`)
- Toolbar: clickable logo → home page (`/`), time slider, undo/redo, transport (skip-back / play-pause / **loop**), **theme toggle (sun/moon)**, save / load / reset, export
- Tabbed preview pane (live animation / live generated JSX). The preview stays mounted under the Code tab so animation engine refs don't churn
- **Light/dark theme** for the app chrome — Tailwind `darkMode: 'class'` driven by `themeStore` (persisted as `reactimate.theme`); `applyThemeClass` runs at module load before React mounts so the first paint matches the saved preference
- Optional `UserMenu` (avatar + email + sign-out) when Firebase auth is enabled

### InspectorBar (top of app)
- **Project row** (always visible): editable `Name` / `Duration` / `Canvas` preset (16:9 · 1:1 · 9:16 · **Custom**) + `W × H` inputs (aspect-locked to the preset, free in `Custom` mode) / `Bg` (swatch ColorPicker + hex text) / `Text` color (swatch ColorPicker) / Quick **Dark site** + **Light site** preset buttons that set bg + default text and rewrite any component whose color matched the prior default
- **Component row** (appears when a component OR one of its effects is selected — so context stays visible while the EffectModal is open): inline **FontPicker** (custom picker, 26 Google Fonts grouped by category, each option rendered in its own family), `Weight`, `Size`, `Color` (swatch ColorPicker), **L/C/R alignment** (per-component), **Remove**
- **ColorPicker** (`components/ui/ColorPicker.tsx`): swatch grid (32 preset colors) with popover, native color-picker fallback via hidden `<input type="color">`, hex text input — replaces all native color pickers across InspectorBar and EffectModal

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
- **New components are visible immediately.** `addComponent` (and both new components `splitOffRange` produces) seed a `custom` "(no effect)" effect spanning `[0, project.duration]`. Without it a fresh component has an empty `effects` array, `compose.ts` never marks it active, and the text the user just componentized vanishes — they did exactly what the editor told them to and got a blank canvas. Same convention `makeWordComponents` uses for the homepage examples. `mergeComponents` is untouched (it inherits its sources' effects)
- `components/editor/useTextSelectionMode.ts` — pure hook that reads the live `Selection` and returns one of `{ kind: "componentize" | "split" | "merge", … }` or `null`
- 26 curated Google Fonts loaded statically from `index.html` (Inter, Manrope, Space Grotesk, Plus Jakarta Sans, Outfit, DM Sans, Fraunces, Playfair Display, Bricolage Grotesque, JetBrains Mono, Anton, Archivo Black, Bebas Neue, Caveat, EB Garamond, Fira Code, Geist, Geist Mono, Karla, Lora, Merriweather, Onest, Oswald, Pacifico, Roboto Slab, Sora) with `display=swap`
- Exported `Hero.tsx` uses `whiteSpace: "pre-wrap"` on the inner `<div>` so `\n` characters render as visible line breaks

### Animation engine (pure logic + tested)
| Module | Purpose |
| ------ | ------- |
| `types/project.ts` | `Project`, `Layer`, `Component`, `Effect`, `ComponentStyle`, `ComputedStyle`, `EasingType`, `EffectType` (incl. `spotlight`/`particle`/`typewriter`/`custom`), spotlight/particle/typewriter config blocks, `staggerLetters` / `staggerDelay` / `staggerDirection`, optional per-effect `from` |
| `engine/easing.ts` | `linear`, `ease-in`, `ease-out`, `ease-in-out`, `spring`, `bounce` |
| `engine/interpolate.ts` | `lerp`, `lerpColor`, `lerpProperty` |
| `engine/ranges.ts` | `adjustRanges`: text-edit → component-index fixup; `rangeOverlapsAny` |
| `engine/palette.ts` | `nextColor` for new components |
| `engine/compose.ts` | `computeComponentStyle(component, time, letterIndex?)` |

**Compose semantics (current):**
- Each effect can declare an explicit per-prop `from` value; if absent, the engine falls back to the previous effect's target (or `component.style` for the first effect)
- `staggerLetters` shifts each letter's per-effect window by `staggerDelay * letterIndex`. `staggerDirection: 'reverse'` animates the last letter first
- `typewriter` auto-derives the per-letter delay from `duration / letterCount`. `typewriter.mode === 'snap'` collapses each letter's window to ~1ms so it flips instantly; `'fade'` uses the effect's normal duration per letter
- **Visibility window**: a component is forced to `opacity = 0` outside any of its effects' `[start, end]` ranges. Typewriter and rotate effects keep the text visible AFTER they finish (the letter stays typed). Particle effects with `continueAfter: true` also stay active past their end. If the component is active but no effect on it touches opacity, baseline opacity is forced to 1 so the user doesn't accidentally render an invisible component
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
- **Type dropdown** ("(no effect) / Fade / Slide / Rotate / Zoom / Color shift / Spotlight / Particle / Typewriter / Blur / Fireworks (lib)") — switching type seeds the new type's defaults and clears stale type-specific config blocks
- `Start` and `Duration` number inputs
- **EasingPicker** — SVG curve graphs in a grid (linear, ease-in, ease-out, ease-in-out, spring, bounce); replaces the easing dropdown
- **Per-prop Start → End editors** for each animated property (opacity, x, y, scale, rotation, color, fontSize, blur) — explicit `from` + `to`
- Type-specific config:
  - **Spotlight:** shape (circle/square), size, color, opacity, motion mode (mouse / sweep-left / sweep-right), maskText + maskMode (tint / reveal) + feather + backdrop toggle, sweepY, **explicit `sweepStart` / `sweepEnd` (x, y)** with reset-to-default
  - **Particle:** density, size, color/preset (gold / silver / rainbow / fire / custom), shape (star / circle / diamond / square), particle type (Standard / Fireworks / Volcano / Dropping via **ParticleTypePicker**), mode (**area** / follow / hover — area replaces the old component/around modes), spawnRadiusPx, lifespanSec, sizeJitter, rotationSpeed, continueAfter — `area` rectangle is dragged on the preview via `EffectAreaOverlay`
  - **Fireworks-js:** density, explosion, gravity, opacity, flickering, acceleration, friction, traceLength, traceSpeed, intensity, lineStyle, hue range, delay range, brightness range, decay range, rocketsPoint range, lineWidth ranges, **`area` rectangle (draggable on preview)**, **Click to launch**, **Follow cursor**, continueAfter
  - **Typewriter:** Snap / Fade letter-reveal toggle, **per-letter shape** (none / square / circle) with Layer (behind/in front) + Color + Size start/end + Blur start/end + Fade start/end + Snap off at end, **Offset X / Y** for stacking duplicate components as drop shadows, staggerDirection forward/reverse
- **Preset save/load bar** at the top:
  - `store/presetStore.ts` — `PresetStorage` interface with two implementations:
    - `LocalStorageBackend` (key: `reactimate.presets.v1`) — used when Firebase isn't configured OR the user is signed out (so presets still work offline)
    - `FirestoreBackend` — `presets` collection guarded by security rules, used when Firebase is configured AND the user is signed in. Presets follow the user across devices. `bulkPut` (Import) is a single atomic batch — the old delete-then-insert could lose everything if the insert half failed
    - `activeBackend()` picks based on `signedIn` flag. The store subscribes to `onAuthStateChanged` and refreshes on every sign-in / sign-out
    - **One-time migration** on first sign-in: if the user's cloud bucket is empty AND they have local presets, the store uploads them. Guarded by a per-session flag so it only fires once per fresh sign-in
  - Save current effect as preset (name)
  - Apply a saved preset (replaces type + config + targets/from on the open effect)
  - Import / Export individual preset as JSON

### Preview rendering
- `components/preview/PreviewCanvas.tsx` — frames the design canvas at true dimensions, scales to fit via CSS transform + `canvasScaleStore`; shows live zoom %, dimensions, preset. Mounts the frame-level overlays: `SpotlightOverlay`, `FireworksLibraryOverlay`, `EffectAreaOverlay`
  - **Empty-state hint** — "visible = componentized" means a user with text but nothing componentized sees a blank canvas with no explanation. When the layer has text and no visible component carries an effect, a muted chip explains why and names the next action ("click Componentize" vs "add an effect from the timeline", depending on whether components exist). Rendered OUTSIDE the scaled frame so it stays legible at any zoom
- `components/preview/RenderedText.tsx`:
  - Splits layer text into plain + componentized segments, sorted by `startIndex`
  - Plain non-whitespace text is **not rendered** in the preview (only componentized text appears) — plain whitespace between components is rendered invisibly to preserve spacing
  - Per-letter rendering kicks in when any effect on the component has `staggerLetters` or is `typewriter`; each letter is its own registered span keyed `${componentId}|${i}`. Typewriter letters with a shape config get a sibling shape span behind/in-front
  - Wraps componentized segments in a **TintWrapper** when any active spotlight effect has `maskText`, layering `TintLayer`/`RevealMaskWrapper` and `ParticleOverlay` as needed
  - Text width uses the full padded canvas area (the previous 55% cap was removed so multi-line text wraps at the real frame edge)
  - Duplicate components share a single inline-grid cell with the base so overlay spans align pixel-perfect with the base text (previous `position: absolute; inset: 0` overlay had a baseline-vs-top alignment mismatch)
- `components/preview/SpotlightOverlay.tsx` — colored backdrop shape (circle/square) that follows mouse / sweep-left / sweep-right; soft feather; optional backdrop toggle; supports explicit `sweepStart`/`sweepEnd` for diagonal/partial sweeps
- `components/preview/ParticleOverlay.tsx` — particle engine with four physics types (Standard, Fireworks, Volcano, Dropping) and three spawn modes (**area**, follow, hover); per-particle lifetime, jitter, rotation, size, color preset; small `drop-shadow` glow so 4-8px particles read against dark text. Re-measures wrapper offset on every render so a text edit can't leave the area math stale
- `components/preview/FireworksLibraryOverlay.tsx` — canvas-based fireworks via [fireworks-js](https://github.com/crashmax-dev/fireworks-js). Mounted at frame level so the 1200×675 backing buffer matches design coords. `areaToBoundaries(cfg.area)` is re-applied after every `updateSize` call so the ResizeObserver doesn't silently clobber boundaries. `mouse.click` / `mouse.move` driven by Click-to-launch / Follow-cursor checkboxes
- `components/preview/EffectAreaOverlay.tsx` — always-on draggable + resizable bbox for every particle/fireworks effect. Color-coded by component, corner handles for resize, snapshotted at pointerdown for 1:1 cursor tracking even mid-drag during React re-renders
- `components/preview/TintLayer.tsx` + `RevealMaskWrapper` — mask the owning component's text so spotlight `tint` / `reveal` modes recolor or hide the text inside the beam
- `store/spotlightStore.ts` — mouse position relative to the preview canvas, fed to spotlight `motion: "mouse"` effects
- `store/canvasScaleStore.ts` — shared scale + position between editor mini-canvas and preview canvas so overlays measure correctly

### Export to Motion JSX (Phase 8)

Toolbar **Export** button downloads **`Hero.tsx`** (always that name; consumer renames if they want). Code tab **Copy** button copies the same source to the clipboard. Output is a single self-contained file using `motion/react` plus optional helpers (see below). React imports for the helpers are consolidated into ONE `import { ... } from "react"` line.

| Source module | What it emits |
|---|---|
| `generateComponent.ts` | The outer wrapper + text spans + assembly. Detects which helpers + extra imports are needed |
| `effectToMotion.ts` | Smart per-property motion props (single → `{delay, duration, ease}`, multi → keyframe arrays with `times`/`ease`; consolidates identical transitions; renames `rotation` → `rotate`; moves animated `color` out of `style` into `initial`/`animate`) |
| `format.ts` | Idiomatic JS-source formatter (unquoted identifier keys, double-quoted strings, inline-or-expand by length, 6-decimal float rounding) |
| `easingMap.ts` | `EasingType` → Motion ease names (`spring`/`bounce` approximate to `easeOut`/`backOut`) |
| `typewriterToMotion.ts` | Per-letter `motion.span` with staggered delay. Snap/fade modes. `staggerDirection: reverse` supported. Optional per-letter shape (square/circle) with size/blur/fade keyframes; `snapOff` overrides opacity to 0 at the end. Newlines emit literal `<br />`. `offsetX`/`offsetY` translate all letters together for shadow stacking |
| `particleToMotion.ts` | **All four physics types** (standard / fireworks / volcano / dropping) baked into pre-sampled keyframe arrays — 4 samples for standard, 10 for physics types — using the same `particlePath()` the preview uses. **All three modes** (area / follow / hover). Cursor modes use a live `<CursorParticleLayer>` helper with `pointermove` tracking + viewport-to-design coord conversion. Particle shape (star / circle / diamond / square) via inlined SVG paths. Rotation keyframes per particle. Small `drop-shadow` glow for fidelity at small sizes |
| `fireworksToMotion.ts` | A `<FireworksLayer>` helper that mounts the canvas, instantiates fireworks-js with all 20+ options (density, explosion, gravity, opacity, flickering, hue range, etc.) + area-derived `boundaries`. Click-to-launch / follow-cursor toggle canvas pointer events. Consumer needs `npm install fireworks-js` |
| `spotlightToMotion.ts` | Backdrop layer (sweep modes via motion's `x`/`y` keyframes, mouse mode via `<MouseSpotlight>` helper with `pointermove`). Soft feather via radial-gradient (matches preview math). Explicit `sweepStart`/`sweepEnd` honored. **`maskText` in both tint and reveal modes** via `<MaskedText>` helper: `useLayoutEffect` measures the text's offset from the canvas-sized ancestor; clip-path `circle()` or `inset()` lerps between start/end (sweep) or follows cursor (mouse); tint mode layers a tinted copy on top of the original, reveal mode clips the original |

**Every editor effect now exports.** What you see in the preview is what lands in `Hero.tsx`.

**Responsive by default.** `fitToWidth.ts` emits a `<FitToWidth>` wrapper around every export. The hero is authored against a fixed design canvas and everything downstream depends on that coordinate space (text laid out in design px; particle / fireworks / spotlight layers absolutely positioned in design coords), so a bare 1200px hero overflowed every phone. The wrapper measures its container with a `ResizeObserver` and applies a uniform `transform: scale(min(1, containerWidth / designWidth))` — a scale rather than a reflow is what keeps every overlay layer aligned. Capped at 1 and sized `maxWidth: designWidth`, so a container at or above the design width renders exactly as it did before the wrapper existed; only narrower containers change. Uses an SSR-safe `useLayoutEffect`/`useEffect` switch so Next.js consumers don't get a server-render warning or a flash of unscaled content.

The `Test-Project/` folder at the repo root is a bare Vite + React 19 + Motion sandbox for drop-in verification: `cd Test-Project && npm install && npm run dev`, then replace `src/Hero.tsx` with your exported file.

### Persistence (Phase 9)
- `persistence/localStorage.ts` — schema-versioned save/load with `validateProject` runtime gate. Auto-migrates old `particle.mode: "component"/"around"` + `rangePx` / `fireworks.mode + spreadRadius` to the new `area` rectangle (defaults centered on canvas, padded for old `spreadRadius`)
- `persistence/useAutosave.ts` — 400ms debounced project-store subscription. Calls `saveToStorage` which writes localStorage immediately AND queues a **throttled cloud write (max one per 10s)** when auth is enabled — Firestore bills per write (20K/day free), so the cloud cadence is decoupled from the localStorage cadence. A `pagehide`/`visibilitychange` flush pushes the pending write when the tab hides or closes
- `persistence/useCloudSync.ts` — once auth resolves to a signed-in user, pulls the cloud project. **Newer-wins**: if localStorage's `savedAt` is fresher than the cloud's `updated_at` (e.g. the tab died inside the 10s throttle window), local wins and re-syncs up; otherwise cloud wins. If only one side has data, that side wins (local migrates up). Runs once per session
- `persistence/shadowFlag.ts` — module-level flag set when the editor's project came from an example or imported `.json`. While set, the autosave pipeline still writes localStorage but **skips** the cloud save, so the user's cloud project isn't silently clobbered. Cleared on first explicit Save-to-cloud (which prompts for overwrite confirmation)
- `persistence/importExport.ts` — `.json` save (download) and load (file picker + validate). Marks shadow on import when signed in
- Toolbar **Smart Save** (`Toolbar.tsx`):
  - **Signed in (cloud active)** → click forces an immediate Firestore sync, flashes a green check on success. **Shift+click** forces a `.json` download instead (escape hatch for local backups)
  - **Signed out / Firebase unconfigured** → click downloads `.json` (the only persistence path available)
  - When the project is in shadow mode + signed in, prompts for confirmation before clobbering the cloud project. DB failure fallback: auto-downloads `.json` so the click isn't wasted
- Toolbar **Import** (file-folder icon) → file picker for `.json`
- Toolbar **Reset-to-sample** with confirm dialog (also clears local storage + temporal stack). Confirm message beefed up for signed-in users explaining the cloud-overwrite risk
- Toolbar **Cloud indicator** badge next to Save: ☁ Cloud (sky blue) when signed in, ⊘ Local (grey) when signed out. Only renders when Firebase is configured
- `store/presetStore.ts` (above) — separate localStorage key, separate from the project blob
- **Cloud model is intentionally ONE project per account** (`projects/{uid}` — the doc id IS the user id). The guardrails above make this safe; multi-project library is on the backlog if user feedback asks for it

### Undo / redo
- `zundo` `temporal` middleware on `projectStore`
- **Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y** keyboard shortcuts (ignore when focus is in an `input`/`textarea`/`contenteditable`)
- Undo / Redo buttons in toolbar

### Optional auth (Firebase)
- Env-gated: `VITE_FIREBASE_CONFIG` (one-line JSON of the web-app config). Unset → app runs as before; auth code never activates. `auth/firebase.ts` is the single chokepoint exporting `{ app, auth, db, isAuthEnabled }`
- `auth/AuthGate.tsx` wraps `/app`; shows `SignInScreen` when enabled and unauthenticated, and a **verify-email screen** for password-only accounts that haven't confirmed their address (Firebase signs users in pre-verification; Supabase didn't — the gate preserves the old behavior, with resend + recheck buttons)
- `auth/SignInScreen.tsx` — email/password sign-in **and** sign-up (with verification email) **and** magic link (`sendSignInLinkToEmail`; the requesting email is stashed in localStorage and redeemed by `useAuth`'s module-level handler when the link lands back on the app, then scrubbed from the URL), plus Google + Apple via `signInWithPopup`. Firebase error codes map to human copy via `friendlyAuthError`
- `auth/useAuth.ts` — `{ isLoading, user }` where `user` is an app-level `AuthUser` (`id`/`email`/`created_at`/`emailVerified`/`providerIds`) adapted from the Firebase user so components don't touch SDK internals. Also calls `ensureMyProfile` on sign-in (profile bootstrap + `last_seen_at`)
- `signOut()` exported alongside

### Tooling & quality
- Vite 6 + React 19 + TypeScript (strict) + Tailwind v3 (`darkMode: 'class'`)
- **fireworks-js** by crashmax-dev (MIT) — canvas-based fireworks engine for the `"fireworks-js"` particle type
- **firebase** — auth + Firestore, env-gated (see Optional auth). Firebase Analytics activates only if the config JSON carries a `measurementId` (i.e. the project gets linked to GA4); silent no-op otherwise. The Vercel analytics/speed-insights packages are gone with the Vercel exit
- ESLint flat config + Prettier
- **139 tests passing across 14 files** — all green through the Firebase migration with zero test edits (the env-gated null client keeps the cloud branch dead under vitest, same as before)
- GitHub Actions CI: `lint` → `typecheck` → `test` → `build`, then a `deploy` job (push to main only) that builds with the repo-variable config and deploys to Firebase Hosting
- Conventional commits; commit log is the design record

### Deployment
- **Firebase Hosting**, project **`reactimate-cloud`** (us-central1 Firestore, Spark/free plan — no pausing, no card). Default URL `https://reactimate-cloud.web.app`; production domain **`https://reactimate.top`** (registered 2026-08-12 through 2031). All SEO meta/sitemap/robots/OG URLs point at `reactimate.top`. The older `reactimate.cloud` domain is deliberately unused — no DNS, no redirect — and lapses 2027-05
- `firebase.json` — SPA rewrite (`** → /index.html`), long-cache headers for `/assets/**`, Firestore rules + indexes wiring. `.firebaserc` pins the default project
- CI deploy job (`.github/workflows/ci.yml`) deploys on push to `main` after checks pass. Both credentials are set: repo **variable** `VITE_FIREBASE_CONFIG` and repo **secret** `FIREBASE_SERVICE_ACCOUNT_REACTIMATE_CLOUD`. First green auto-deploy 2026-08-13. Manual fallback: `npm run build && firebase deploy --only hosting`
- `main` is protected (2026-08-13): required status check `verify` (only — `deploy` is push-only and would deadlock PRs), no force pushes, no deletions, `enforce_admins: false` so direct pushes still work. Note the deploy job already declares `needs: verify`, so a red build skips deploy and prod keeps the last good release
- The Supabase keep-alive cron workflow is deleted — Firebase free projects never pause
- Google Search Console verification file (`public/google995357ceb40b715c.html`) still ships; the `reactimate.top` property needs adding + sitemap resubmit (follow-up)

---

## Not implemented yet

### Firebase cutover — remaining manual steps
**Status (2026-08-12 EOD):** LIVE and verified at https://reactimate.top — DNS connected, cert issued (~32 min), all four auth providers enabled + authorized. Verified on prod: Google sign-in, Apple sign-in, email/password sign-up (verification email delivered; landed in spam pre-custom-domain), profile bootstrap (create-race fixed in `82d435e`), admin gate, Firestore autosave. GitHub hardening on: secret scanning, push protection, Dependabot security updates (`npm audit` 10 → 0 same day). **Custom email domain** (`noreply@reactimate.top`): SPF merged with Namecheap forwarding SPF, `firebase=` TXT + both DKIM CNAMEs added and resolving — awaiting Firebase's verification pass (auto-switches senders when done; fixes the spam-folder problem). Remaining:
- ~~Teardown~~ **DONE 2026-08-12**: Vercel project and Supabase project deleted; `SUPABASE_URL` / `SUPABASE_ANON_KEY` repo secrets removed. reactimate.vercel.app is gone (no redirect — old indexed URLs will fall out of Google naturally)
- ~~Magic link~~ **DONE 2026-08-12**: custom email domain verified, magic-link sign-in tested end-to-end from noreply@reactimate.top. ALL FOUR sign-in methods now verified on prod (Google, Apple, email/password + verification, magic link)
- ~~Create the CI deploy secret~~ **DONE 2026-08-13**: `FIREBASE_SERVICE_ACCOUNT_REACTIMATE_CLOUD` set from a Firebase service-account key. Auto-deploy on push to `main` verified green (Hosting release 2026-08-13 01:41 UTC, config baked into the deployed bundle). Every main push since the cutover had been failing on this step
- Parked (cosmetic): console rejects `https://reactimate.top/__/auth/action` as a custom email action URL despite the handler serving 200 there (known console quirk with reserved `/__/` paths). Links inside auth emails point at firebaseapp.com; sender is authenticated, so deliverability is unaffected. Alternative if ever wanted: build an in-app `/auth/action` handler route
- Add the `reactimate.top` property in Google Search Console + resubmit the sitemap
- Optional: link the Firebase project to GA4 (console → Integrations) and add the resulting `measurementId` to `VITE_FIREBASE_CONFIG` (repo variable + `.env.local`) to activate the built-in analytics hook

### Multi-project cloud library (Option B)
**Status:** deliberately deferred — the single-project model is shipped with guardrails (shadow flag, save-overwrite confirm, reset warning, Cloud/Local indicator) that make it safe. Revisit if user feedback asks for it. **Effort:** ~15-30 min.
- Schema: key projects by auto-id docs (`projects/{projectId}` with a `user_id` field + composite index) instead of doc-id-per-user
- API: `listProjects()`, `loadProject(id)`, `saveProject(project)` (insert-or-update by id), `deleteProject(id)`, `renameProject(id, name)`
- UI: "Projects" dropdown in the toolbar near the project name (or an `/app/projects` route) showing a list; "Save As..." to fork on name conflict
- Migration: existing one-doc-per-user data stays valid; old projects load fine, new ones can coexist

### Phase 2 — layout polish
**Status:** mostly done via the editor/inspector overhaul. Remaining: better empty/error states, breakpoint behavior, a polish pass on spacing/typography. Probably "read-only on mobile" rather than building a real touch editor.

### Known editor quirk: cursor past a trailing `\n`
**Effort:** small, low priority.
If the user presses Enter at the very end of the text and then types, the new text lands BEFORE the trailing `\n` (browser-level quirk — `execCommand('insertText')` and native typing both visually treat "after \n at end of node" the same as "at end of previous line"). The text and exported JSX are both fine; only the caret position is unintuitive in that one edge case. Workarounds: don't allow trailing newlines (auto-trim), or replace `\n` with `<br>` elements (bigger refactor, breaks the single-text-node selection model).

### Backlog (polish)
- Templates / starter projects (curated `Project[]` users can clone — could ship as importable JSON via existing load flow)
- Keyboard nudge (arrow keys when an effect block is selected: ±50ms move, with Shift = bigger step)
- Onboarding tooltips for first-time users
- Cubic-bezier easing curve editor in the EasingPicker (currently 6 named presets)
- Compact toolbar when narrow
- Tests for the new effect types (particle physics paths, spotlight masking math, typewriter timing)
- Bundle splitting — single chunk is now ~1,426 KB (380 KB gzipped; the Firebase SDK added ~200 KB gzip). `manualChunks` for `firebase` + `motion` + `fireworks-js`, or dynamic-importing the Firebase modules behind the env gate, would cut the initial payload substantially

### Far horizon
- Multiple stacked layers (multi-line text exists today via `\n`; per-layer animations would let you stack independent text/shape blocks)
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
