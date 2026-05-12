# reactimate

**Hero Animator** — a browser-based visual tool for building animated hero sections that exports clean React + Motion code.

Type text, select words/phrases and turn them into colored "components", give each component effects on a timeline, scrub/play to preview, then export a `Hero.jsx` Motion component that drops into any React project.

## Status: Phase 1 — foundation

| Phase | Done | What it adds |
| ----- | ---- | ------------ |
| 0 — scaffold (Vite + React + TS + Tailwind) | ✓ | Build/test/lint pipeline + CI |
| 1 — types, stores, engine logic | ✓ | `Project` model, Zustand stores, `adjustRanges` / `computeComponentStyle` / `lerp` with tests |
| 2 — layout shell | — | Three-pane Grid layout |
| 3 — text editor + overlay | — | contenteditable + colored range outlines |
| 4 — selection → create component | — | Popover + create dialog |
| 5 — preview rendering | — | Real componentized rendering |
| 6 — animation engine (RAF + DOM writes) | — | Playback/scrub of the preview |
| 7 — timeline | — | Effect blocks, drag/resize, playhead |
| 8 — export | — | Project → Motion JSX file |
| 9 — polish | — | Autosave, undo/redo, shortcuts |

## Stack

- React 19 + TypeScript (strict) + Vite + Tailwind v3
- **Zustand** + **zundo** — state + undo/redo
- **Motion** (formerly Framer Motion) — only for the exported output, not for editor playback
- **@dnd-kit/core** — timeline drag interactions
- **nanoid**, **lucide-react**
- **Vitest** + Testing Library for the pure-logic modules

Editor playback uses raw `requestAnimationFrame` + direct DOM style writes. Motion is what the *generated* code uses.

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

## Getting started

```sh
npm install
npm run dev
```

Open <http://localhost:5173>.

## Layout

```
src/
├── App.tsx                            # three-pane shell
├── main.tsx
├── index.css                          # Tailwind directives + globals
├── vite-env.d.ts
│
├── types/
│   └── project.ts                     # Project / Layer / Component / Effect / ComputedStyle
│
├── engine/                            # PURE LOGIC — covered by tests
│   ├── easing.ts                      # easing curves
│   ├── interpolate.ts                 # lerp + color lerp
│   ├── ranges.ts                      # adjustRanges (text-edit → range fixup)
│   ├── palette.ts                     # nextColor (assigns the next UI box color)
│   ├── compose.ts                     # computeComponentStyle(c, time)
│   └── __tests__/
│
├── store/
│   ├── projectStore.ts                # Zustand + zundo (undo/redo)
│   ├── selectionStore.ts              # what's selected
│   └── playbackStore.ts               # isPlaying, currentTime
│
├── utils/
│   ├── id.ts                          # nanoid wrapper
│   └── colors.ts                      # hex/rgb/hsl parsing
│
├── constants/
│   ├── fonts.ts                       # curated Google Fonts list
│   ├── presets.ts                     # canvas presets (16:9, 1:1, 9:16)
│   └── effects.ts                     # per-effect-type defaults
│
└── sample/
    └── sampleProject.ts               # hardcoded project so the UI has data
```

## Critical engine rule

Every animatable property has a value at `t=0` (from `component.style`). Effects animate **from** the previous value of that property **to** their `targets` entry. When multiple effects touch the same property, they're applied in time order — "last completed value wins." See `engine/compose.ts` and its tests.

## License

MIT — see [LICENSE](./LICENSE).
