# reactimate

A website tool to animate text with React.

## Stack

- [Vite](https://vitejs.dev/) + React 19 + TypeScript (strict)
- [Vitest](https://vitest.dev/) + Testing Library for tests
- ESLint (flat config) + Prettier
- GitHub Actions CI

## Scripts

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start the Vite dev server                     |
| `npm run build`    | Typecheck + production build to `dist/`       |
| `npm run preview`  | Preview the production build locally          |
| `npm test`         | Run the test suite once                       |
| `npm run test:watch` | Run tests in watch mode                     |
| `npm run typecheck`| Run the TypeScript compiler in check mode    |
| `npm run lint`     | Run ESLint                                    |
| `npm run format`   | Format all files with Prettier                |

## Getting started

```sh
npm install
npm run dev
```

Then open the printed URL (usually <http://localhost:5173>).

## Layout

```
src/
├── App.tsx                       # demo page
├── main.tsx                      # React entry point
├── index.css                     # global styles + keyframes
├── components/
│   └── AnimatedText.tsx          # per-character stagger animation
├── __tests__/                    # vitest + RTL tests
├── test/setup.ts                 # jest-dom matchers
└── vite-env.d.ts
```

## License

MIT — see [LICENSE](./LICENSE).
