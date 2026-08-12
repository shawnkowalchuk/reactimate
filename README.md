# reactimate

**Hero Animator** — a browser-based visual tool for building animated hero sections that exports clean, idiomatic React + Motion code you can drop into any React project.

Type some hero text. Select words and turn them into colored "components." Add effects on a timeline (fade, slide, scale, rotate, color-shift). Scrub or play to preview. Click **Export** — out comes a self-contained `Hero.tsx` using `motion/react` that needs nothing from this app to run.

For the **current implementation status and outstanding work** see [STATUS.md](./STATUS.md).

---

## Quick start

```sh
git clone https://github.com/shawnkowalchuk/reactimate.git
cd reactimate
npm install
npm run dev
```

Open http://localhost:5173. The app autosaves to `localStorage` so your work survives reloads.

---

## Using the tool

1. **Edit components** on the timeline — drag the colored blocks to change when an effect starts; drag the edges to resize its duration. Hold **Shift** to disable the 50ms snap grid.
2. **Click an effect block** to bring up the inspector strip — change easing, fine-tune start/duration with number inputs, or delete.
3. **Play / Pause** with the toolbar button or **Spacebar**. **Scrub** by dragging the playhead or using the time slider.
4. **Undo / Redo** with **Ctrl+Z / Ctrl+Shift+Z** (or the arrow buttons in the toolbar).
5. **Save** the project as a `.json` file, **Load** a saved one, or **Reset** back to the bundled sample.
6. **Export** downloads a ready-to-use `Hero.tsx`.
7. **Preview / Code tabs** — switch the right pane to see the generated code live as you edit.

Phases 2–4 of the build plan (a proper contenteditable text editor with an in-place "Create component" popover) are not yet shipped. For now, layer text and component ranges are defined by the bundled sample project; edit those via the timeline + inspector and re-export.

---

## Using an exported `Hero.tsx` in your own project

The exported component is self-contained. It uses Motion (formerly Framer Motion) and nothing else. To drop it into any React 18 / 19 project:

```sh
npm install motion
```

Move the downloaded `Hero.tsx` into your project (anywhere, e.g. `src/components/Hero.tsx`), then:

```jsx
import { Hero } from "./components/Hero";

export default function Page() {
  return <Hero />;
}
```

That's it. No global config, no provider, no other dependencies. The component renders a fixed-size canvas (matching the preset you chose in the editor) with Motion-driven children — restyle the outer wrapper as you like.

### What the output looks like

The generator preserves a "what a human would write" shape. For a single multi-prop effect, it consolidates to one shared transition:

```jsx
<motion.span
  style={{ fontFamily: "Inter", fontSize: 96, fontWeight: 800, color: "hsl(25, 90%, 60%)", display: "inline-block" }}
  initial={{ opacity: 0, y: 20, scale: 0.9 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ delay: 0.7, duration: 0.6, ease: "easeOut" }}
>{"reactimate"}</motion.span>
```

When properties have separate timings or multiple effects, they get per-property keyframe arrays with `times` and a per-segment `ease` array.

Notes:
- `spring` and `bounce` map to `easeOut` and `backOut` respectively (Motion's spring is a transition *type*, not a curve, and can't go into a multi-keyframe ease array). Edit by hand if you want `type: "spring"` instead.
- All text content is rendered as `{"…"}` JSX expressions so quotes / braces in your source text can't break parsing.

---

## Authentication (optional)

The app runs **without authentication by default** — projects live in `localStorage` per-browser and the editor works exactly as described above.

If you want user accounts (email + magic link + Google + Apple) and cross-device sync, wire up [Firebase](https://firebase.google.com). Auth activates the moment you set the env var; it gates the editor behind a sign-in screen and syncs your project + effect presets to Firestore.

### 1. Create a Firebase project

```sh
npm i -g firebase-tools
firebase login
firebase projects:create <your-project-id>
firebase apps:create WEB <app-name> --project <your-project-id>
firebase firestore:databases:create "(default)" --location us-central1 --project <your-project-id>
```

(Or click through the [Firebase console](https://console.firebase.google.com) — the free Spark plan is plenty; no credit card needed.)

### 2. Enable sign-in providers

In the Firebase console under **Build → Authentication → Sign-in method**:

- **Email/Password** — enable it, and also switch on **Email link (passwordless sign-in)** on the same panel for magic links.
- **Google** — enable, pick a support email. Done.
- **Apple** — enable. Requires an Apple Developer Program membership ($99/year). You'll need:
  - A **Services ID** (Apple Developer → Identifiers → Services IDs) with Sign in with Apple enabled
  - A **Private Key** (Keys → +, with Sign in with Apple checked)
  - Add `https://<your-project-id>.firebaseapp.com/__/auth/handler` to the Services ID's Return URLs
  - Paste the Services ID, Team ID, Key ID, and the contents of the `.p8` private key into the Firebase provider config

### 3. Deploy the Firestore rules

The Feedback page (`/feedback`), Admin backend (`/admin`), and cloud-stored projects/presets are protected by [`firestore.rules`](./firestore.rules) (plus the composite indexes in [`firestore.indexes.json`](./firestore.indexes.json)):

```sh
firebase deploy --only firestore
```

Collections used: `profiles` (one doc per user, created on first sign-in), `projects` (one doc per user, id = uid), `presets`, and `feedback` with a `replies` subcollection.

### 4. Add the env var to this app

Copy `.env.example` to `.env.local` and paste your web app config as one line of JSON (Firebase console → Project settings → Your apps → SDK setup → Config, or `firebase apps:sdkconfig WEB <appId>`):

```
VITE_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
```

Restart `npm run dev`. The app now shows a sign-in screen before the editor. (This config is public by design — security comes from the Firestore rules, not the key.)

### 5. Promote yourself to admin

After signing in once (which creates your profile doc), open **Firestore → Data → `profiles` → your uid** in the Firebase console and set `is_admin` to `true`.

The `/admin` nav link will appear in the navbar; you'll have access to the Dashboard, Users, and Feedback admin pages. Identity linking on `/settings` works out of the box — no extra toggles.

### Heads-up

When signed in, your **current project and effect presets sync to your account** and follow you across devices. The cloud holds ONE editor project per account — the Save button warns before overwriting it with an imported or example project. Signed out, everything stays in `localStorage`.

---

## Stack

- **React 19** + **TypeScript** (strict) + **Vite** + **Tailwind v3**
- **Zustand** + **zundo** — state with undo/redo
- **Motion** (formerly Framer Motion) — for *exported* output only; editor playback uses raw `requestAnimationFrame` + direct DOM style writes for performance
- **@dnd-kit/core**, **nanoid**, **lucide-react**
- **firebase** — optional auth + Firestore sync (only activates when `VITE_FIREBASE_CONFIG` is set)
- **Vitest** + Testing Library for the pure-logic modules

---

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Run the TypeScript compiler in check mode |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

---

## Deployment

Hosted on **Firebase Hosting** (project `reactimate-cloud`) at https://reactimate.cloud. Pushes to `main` auto-deploy via the `deploy` job in [ci.yml](./.github/workflows/ci.yml) after lint/typecheck/test/build pass. That job needs two repo settings:

- **Actions variable** `VITE_FIREBASE_CONFIG` — the public web-app config JSON baked into the build.
- **Actions secret** `FIREBASE_SERVICE_ACCOUNT_REACTIMATE_CLOUD` — a service-account key with Hosting deploy rights (Firebase console → Project settings → Service accounts, or `firebase init hosting:github` to generate one).

Manual deploy from a machine with `firebase login`:

```sh
npm run build
firebase deploy --only hosting
```

Firestore rules/indexes deploy separately: `firebase deploy --only firestore`.

---

## Roadmap

| Phase | What | Status |
| ----- | ---- | ------ |
| 0 — scaffold | Vite + TS + Tailwind + lint + CI | ✓ |
| 1 — foundation | types, stores, engine logic + tests | ✓ |
| 3 — text editor | contenteditable + colored range overlay | ✓ |
| 4 — componentize | Componentize / Split / Merge toolbar buttons | ✓ |
| 5 — preview | live `RenderedText` + canvas frame | ✓ |
| 6 — engine | RAF + DOM writes, scrub/play, visibility window | ✓ |
| 7 — timeline | draggable effect blocks, modal-based editor, duplicate, wheel-dampened scroll | ✓ |
| 8 — export | `Hero.tsx` generator (core effects) + Copy/Download | ✓ |
| 9 — persistence | localStorage autosave, save/load, undo/redo, effect presets | ✓ |
| Auth (opt) | Firebase email + magic link + Google + Apple, sign-in gate | ✓ |
| Inspector | Always-on Project + Component InspectorBar at top, EffectModal w/ easing graphs + per-prop start/end | ✓ |
| Spotlight effect | mouse / sweep motion, mask + feather + backdrop | ✓ |
| Particle effect | 4 spawn modes × 4 particle physics presets + fireworks-js integration by crashmax-dev | ✓ |

| Export spotlight / particle / typewriter | emit real Motion JSX for the new effect types | — |
| Cloud project storage | per-user project doc in Firestore, cross-device sync | ✓ |
| Templates / starter projects | — | — |

---

## License

MIT — see [LICENSE](./LICENSE).
