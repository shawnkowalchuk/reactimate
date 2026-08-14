# Contributing to reactimate

Thanks for taking a look. This is a small, friendly project — issues, questions, and
pull requests are all welcome, including "I tried it and this bit confused me."

If you're looking for somewhere to start, the
[`good first issue`](https://github.com/shawnkowalchuk/reactimate/labels/good%20first%20issue)
label marks work that's self-contained and doesn't need a tour of the codebase first.

---

## Getting set up

Node 22 (what CI uses) and npm:

```sh
git clone https://github.com/shawnkowalchuk/reactimate.git
cd reactimate
npm install
npm run dev
```

Open http://localhost:5173. That's the whole setup — **you do not need a Firebase
project or any environment variables to develop.** With `VITE_FIREBASE_CONFIG`
unset the app runs entirely from `localStorage` with auth disabled, which is the
normal contributor experience. Cloud sync and the admin area only switch on when
that variable is present (see the README if you want to run them).

## Before you push

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs exactly these four on every push and pull request, and `main` is protected
on that check — so running them locally saves you a round trip. Please keep the test
suite green; if you change behavior covered by a test, update the test in the same
commit as the change.

## Where things live

| Path | What's in it |
| --- | --- |
| `src/engine/` | Pure animation logic — timing, easing, interpolation, style composition. Well covered by tests; a good place to start reading. |
| `src/export/` | The code generator that turns a project into `Hero.tsx`. The exported output is the heart of the product. |
| `src/components/` | Editor, preview, timeline, and marketing-page UI. |
| `src/store/` | zustand stores (project state uses zundo for undo/redo). |
| `src/persistence/` | localStorage autosave, import/export, optional cloud sync. |
| `src/api/`, `src/auth/` | Firestore data access and Firebase auth — all env-gated. |

Tests live in `__tests__/` folders beside the code they cover and run under Vitest.
The pure modules (`engine/`, `export/`, `utils/`) are the easiest to test and the
most valuable to keep correct.

[STATUS.md](./STATUS.md) is the honest, detailed inventory of what's built and
what isn't — worth skimming before proposing something large, since it may already
be listed as deliberately deferred.

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- **Formatting** is Prettier — `npm run format` before committing keeps diffs clean.
- **TypeScript is strict.** Avoid `any`; the compiler catching things is a feature.
- Match the style of the code around you rather than introducing a new pattern.

## Opening an issue

Bug reports are more useful with: what you did, what you expected, what happened,
and your browser/OS. If it involves a specific animation, exporting the project as
JSON (Shift+click Save in the toolbar) and attaching it makes reproduction trivial.

Feature ideas are welcome too — check STATUS.md first in case it's already on the
roadmap, then open an issue to discuss before writing a large PR, so nobody spends
an evening on something that doesn't fit.

## Pull requests

Keep them focused on a single change, describe what and why in the body, and
include a screenshot or GIF for anything visual. Small PRs get reviewed faster
than large ones.

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE), the same as the rest of the project.
