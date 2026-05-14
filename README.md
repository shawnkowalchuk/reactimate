# reactimate

**Hero Animator** — a browser-based visual tool for building animated hero sections that exports clean, idiomatic React + Motion code you can drop into any React project.

Type some hero text. Select words and turn them into colored "components." Add effects on a timeline (fade, slide, scale, rotate, color-shift). Scrub or play to preview. Click **Export** — out comes a self-contained `Hero.jsx` using `motion/react` that needs nothing from this app to run.

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
6. **Export** downloads a ready-to-use `Hero.jsx`.
7. **Preview / Code tabs** — switch the right pane to see the generated code live as you edit.

Phases 2–4 of the build plan (a proper contenteditable text editor with an in-place "Create component" popover) are not yet shipped. For now, layer text and component ranges are defined by the bundled sample project; edit those via the timeline + inspector and re-export.

---

## Using an exported `Hero.jsx` in your own project

The exported component is self-contained. It uses Motion (formerly Framer Motion) and nothing else. To drop it into any React 18 / 19 project:

```sh
npm install motion
```

Move the downloaded `Hero.jsx` into your project (anywhere, e.g. `src/components/Hero.jsx`), then:

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

If you want user accounts (email + Google + Apple), wire up [Supabase](https://supabase.com). Auth activates the moment you set the env vars; it gates the editor behind a sign-in screen.

### 1. Create a Supabase project

1. Sign up at https://supabase.com (free tier is fine).
2. Create a new project.
3. Once it's provisioned, in the dashboard go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key

### 2. Configure providers in the Supabase dashboard

Under **Authentication → Providers**:

- **Email** — enabled by default. To force email verification before sign-in, turn on **"Confirm email"** under Email settings.
- **Google** — toggle on, then paste a **Client ID** and **Client Secret** from a Google Cloud OAuth client (Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application). Add Supabase's callback URL (`https://<project>.supabase.co/auth/v1/callback`) to the OAuth client's Authorized redirect URIs.
- **Apple** — toggle on. Requires an Apple Developer Program membership ($99/year). You'll need:
  - A **Services ID** (created in Apple Developer → Identifiers → Services IDs) with Sign in with Apple enabled
  - A **Private Key** (Keys → +, with Sign in with Apple checked)
  - Add Supabase's callback URL to the Services ID's "Return URLs"
  - Paste the Services ID, Team ID, Key ID, and the contents of the `.p8` private key into Supabase

### 3. Add the env vars to this app

Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi…
```

Restart `npm run dev`. The app now shows a sign-in screen before the editor.

### 4. Run the SQL schema

To enable the **Feedback page** (`/feedback`), the **Admin backend** (`/admin`), and **cloud-stored effect presets**, paste [`supabase/schema.sql`](./supabase/schema.sql) into the Supabase project's **SQL Editor** and run it. It creates:

- `public.profiles` — one row per auth user, populated by a trigger on `auth.users` insert. Carries `is_admin: boolean`.
- `public.feedback` — user-submitted messages.
- `public.feedback_replies` — admin replies to a thread.
- `public.feedback_with_counts` — view exposing `reply_count` and `last_reply_at`.
- `public.presets` — per-user saved effect presets, with RLS so each user sees only their own.
- RLS policies so users can only read their own data and admins can read everything.

Already ran the schema before presets shipped? Just run [`supabase/migrations/2026_05_13_presets.sql`](./supabase/migrations/2026_05_13_presets.sql) instead — it's the same `presets` block in isolation.

### 5. Promote yourself to admin

After signing in once (which creates your profile row via the trigger), run in the SQL editor:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

The `/admin` nav link will appear in the navbar; you'll have access to the Dashboard, Users, and Feedback admin pages.

### 6. Enable manual identity linking (optional, for `/settings`)

If you want users to link multiple sign-in providers to one account (e.g. Email + Google + Apple on the same `auth.users` row), enable:

**Authentication → Sign In / Up → Manual Linking** (toggle on).

With this off, the link buttons on `/settings` will fail with "Manual linking is not enabled". Unlinking still works in both cases.

### Heads-up

In v1, the **projects still live in `localStorage`** per browser even when signed in. Auth currently does access control only — it doesn't sync your projects across devices. Per-user cloud project storage is a separate planned feature.

---

## Stack

- **React 19** + **TypeScript** (strict) + **Vite** + **Tailwind v3**
- **Zustand** + **zundo** — state with undo/redo
- **Motion** (formerly Framer Motion) — for *exported* output only; editor playback uses raw `requestAnimationFrame` + direct DOM style writes for performance
- **@dnd-kit/core**, **nanoid**, **lucide-react**
- **@supabase/supabase-js** — optional auth (only loaded when env vars are set)
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
| 8 — export | `Hero.jsx` generator (core effects) + Copy/Download | ✓ |
| 9 — persistence | localStorage autosave, save/load, undo/redo, effect presets | ✓ |
| Auth (opt) | Supabase email + Google + Apple, sign-in gate | ✓ |
| Inspector | Always-on Project + Component InspectorBar at top, EffectModal w/ easing graphs + per-prop start/end | ✓ |
| Spotlight effect | mouse / sweep motion, mask + feather + backdrop | ✓ |
| Particle effect | 4 spawn modes × 4 particle physics presets + fireworks-js integration by crashmax-dev | ✓ |

| Export spotlight / particle / typewriter | emit real Motion JSX for the new effect types | — |
| Cloud project storage | per-user project rows in Supabase, sync | — |
| Templates / starter projects | — | — |

---

## License

MIT — see [LICENSE](./LICENSE).
