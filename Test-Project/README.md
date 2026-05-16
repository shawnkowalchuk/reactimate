# Reactimate Test App

A bare-bones Vite + React + Motion app for testing whatever you export from the [reactimate](../README.md) editor.

## Setup

```bash
cd Test-Project
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5174/`).

## How to test a Hero export

1. In the reactimate editor, build your animation, click **Export** in the toolbar — you'll get a file like `untitled-hero.jsx` (or whatever your project name is).
2. Rename it to `Hero.tsx` (or `.jsx` if you prefer) and drop it into `src/` — replace the placeholder.
3. Save. Vite hot-reloads.

## What you should see

A black landing page with a top nav, your hero centered in the middle, and a footer. The exported Motion animation plays on mount and matches what you saw in the editor preview.

## Troubleshooting

- **Missing dependency error for `motion`** — `npm install motion`.
- **Missing `fireworks-js`** if you exported a fireworks effect — `npm install fireworks-js`.
- **Hero file uses `.jsx` extension but TypeScript complains** — rename to `.tsx`, or remove `tsconfig.json` strict checks.

## Why this exists

The reactimate exporter spits out plain Motion JSX that should work in any React 19 + Motion project. This sandbox lets you verify the export actually drops cleanly into a real app before you ship it to your real site.
