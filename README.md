# ns-ui

Personal registry of high-craft components. Two collections: `core` (Geist-dark restraint) and `loud` (flashy showcase). Spec: `docs/superpowers/specs/2026-07-17-component-library-design.md`.

## Run

```bash
npm install
npm run dev            # preview site — / lists components, /preview/<name> renders one
```

## Verify (quality gate)

Dev server must be running.

```bash
npm run verify                          # all components
node scripts/verify.ts glass-button     # one component
BASE_URL=http://localhost:3001 npm run verify   # non-default port
```

Renders every component headlessly, screenshots states (default/hover/scroll) × themes (dark/light) into `registry/<collection>/<name>/screenshots/`, fails on console errors, blank renders, or invalid `meta.json`.

## Add a component

1. Create `registry/<collection>/<name>/` with `component.tsx`, `demo.tsx`, `meta.json` (name, collection, tags, instruction, dependencies).
2. Register the demo in `registry/index.tsx` (one line).
3. Add the item to `registry.json`.
4. `npm run registry:build` → emits `public/r/<name>.json`.
5. `npm run verify` — component is done only when it passes and survives the screenshot-judge loop.

## Install into another project

From any Next.js + Tailwind project with shadcn configured (`npx shadcn init -d`):

```bash
npx shadcn add http://localhost:3000/r/glass-button.json
```

Drops the source at `components/ui/<name>.tsx` and installs its npm deps. After a public deploy, swap localhost for the deployed URL.

> Machine note: this machine's `~/.npmrc` sets `minimum-release-age`, which breaks `npx shadcn@latest` with `npm error Invalid Version`. Workaround: `npm i -D shadcn` in the consumer project and use `npx shadcn` (local resolution).
