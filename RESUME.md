# ns-ui — Resume Handoff

Last session: 2026-07-18. State: **24 components, all committed, tree clean.**

## What this is

Personal component registry (React + Tailwind v4 + Motion + r3f, Next.js preview site, shadcn-registry distribution). Two collections: `core` (Geist-dark restraint), `loud` (flashy, gradient-exempt). Three staged purposes: personal kit now → AI training corpus (meta.json + screenshots) → maybe public. Spec: `docs/superpowers/specs/2026-07-17-component-library-design.md`.

## Where things are

- **Components:** `registry/core/*` (20), `registry/loud/*` (4). Each = `component.tsx` + `demo.tsx` + `meta.json` + `screenshots/`.
- **Registry index:** `registry/index.tsx` (lazy demo map) + generated `registry.json`. Source of truth = `meta.json` sidecars; `npm run registry:build` regenerates.
- **Quality gate:** `scripts/verify.ts` — Playwright renders each preview, screenshots states×themes, fails on console error / blank render / hover-identical-to-default / bad meta.
- **Research artifacts:** `docs/inspiration.md` (56-site harvest, 15 ranked), `docs/catalog.md` (1,535 effects, 18 novel finds), `tickets.md` (build log).

## The 24

core: glass-button, particle-hero, decrypt-text, ascii-dither-media, glass-panel, magnetic-dock, dynamic-weight-text, hold-to-confirm, particle-tunnel-scrub, signal-terrain, mercury-minimap, slide-to-shatter, moire-dial, vapor-countdown, crack-compare, cardio-baseline, chronicle-bar, ligature-melt, respire-field, warp-lattice
loud: singularity-text, prism-drag-split, erosion-trail, frost-scrub

## Workflow to run each session (dev loop)

```bash
cd ~/Developer/misc/ns-ui
npm install          # if fresh
npm run dev          # preview site (note the port — 3000 often taken → 3001)
```
Then per component: write folder → add to `registry/index.tsx` → `npm run registry:build` → `npm run typecheck` → `BASE_URL=http://localhost:<port> node scripts/verify.ts <name>` → read screenshot, judge, iterate → commit.

## The breeder pipeline (how the last 16 were made)

Workflow scripts saved under `~/.claude/projects/.../workflows/scripts/component-fusion-breeder*.js`. Pattern: N ideators each fuse a forced gene-pair from `docs/catalog.md` → judge ranks top K with numeric build briefs → K parallel builders write component folders ONLY (registration stays central — never let parallel agents touch index.tsx/registry.json) → integrator registers, gates, contact-sheets, commits. Round 2 hit 10/10 first-try green.

## Next moves (pick on resume)

1. **Round 3 breeding** — scale up, or steer with a theme (all scroll-story / all heroes / etc).
2. **Tune pass** — judge components live, dial the ones that feel off.
3. **Ship** — create GitHub repo + deploy preview site → real registry URL, `npx shadcn add` works anywhere. PARKED, needs owner go. Note: Vercel auto-deploy blocked by GitHub account flag → use Railway/Cloudflare, or manual Vercel.
4. **Corpus** — 24 × (instruction + screenshots) already accumulating; wire embedding/training when ready.

## Parked decisions (owner)

- No git remote yet → nothing pushed. Auto-push rule waits on repo creation (outward-facing).
- Machine quirk: `~/.npmrc` `minimum-release-age` breaks `npx shadcn@latest` (`Invalid Version`). Workaround baked in: local `shadcn` devDep + `npx shadcn`.

## Resume command

`/resume` or reopen and point at this file. First action: `npm run dev`, confirm `localhost:<port>` renders, then continue.
