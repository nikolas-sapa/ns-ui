# Round 13 — landing-page surfaces only

Worktree: `~/Developer/misc/ns-ui-r13` (branch `feat/r13-landing`). Work ONLY here.

30 components, 3 waves of 10. Every component must name the landing-page
surface it replaces: hero, background, section divider/transition, pricing,
CTA, testimonial / social proof, logo wall, feature grid, marquee, footer,
waitlist/signup moment, gallery.

## Auto-reject (no exceptions)
- Dashboards, admin, settings, config, developer tools, API/quota/credits/rate-limit surfaces.
- Anything whose identity is a hue. Monochrome-native only.
- A process that finishes and stops (must be alive at rest, unforced, unbounded loop).
- Sourcing from web trend search ("award site preloader 2026", Framer/Envato listings). Banned — this failure mode already got components built and removed.
- A restyle of an existing slug. If after reading the nearest existing component you conclude yours is a restyle: say so and STOP. Killing your own concept is a success.

## Source from
1. Rendering TECHNIQUE, not subject (sub-cell grids, dithering families, display-hardware artifacts, print reproduction, type-setting mechanics).
2. A real physical / industrial / print PROCESS that actually exists.
3. Gaps named more than once in this repo's own docs (`docs/21st-bookmarks.md`, `docs/component-backlog.md`).

## Token / build rules (each item earned by a real bug)
- ZERO colour literals, including fallbacks and inside GLSL. Only `--background`, `--foreground`, `--ns-muted`, `--border`, `--ns-accent`, read via `getComputedStyle(document.documentElement)` + `MutationObserver` on documentElement class.
- NO PAINT BEFORE THE FIRST TOKEN READ — trace the rAF start, `ResizeObserver`, and `IntersectionObserver` resume paths specifically.
- `--border` is a separator token (~1.1:1 in light theme) — invisible as a fill or stroke.
- `--ns-accent` is interaction chrome ONLY (buttons, focus rings). Never in a pointer/beam/highlight, never on the climactic moment. Pointer highlights move in LUMINANCE only. This is the single most repeated defect on the project.
- Alive at rest = visibly different at t0 / 2.5s / 5s with zero input, via unconditional self-animation (CSS `infinite` keyframe or always-running rAF). An `autoplay` descriptor does NOT count — the gate never fires it.
- `prefers-reduced-motion: reduce` freezes on a deliberately chosen NON-t0 most-structured frame, and those frames must be byte-stable over time.
- Derive geometry from the container's SMALLER dimension so it reads at card scale, not just full-bleed.
- A canvas needs `w-full h-full` (or JS-set style dimensions) or it falls back to intrinsic size — check at dsf 2, not just dsf 1.
- Canvas hosts: DPR-aware backing store (cap 1.5-2), `ResizeObserver` on the host (not `window.resize`), pause on `IntersectionObserver` offscreen + `visibilitychange`, adaptive scale only after sustained measured slowness (never on device heuristics, never gated on frame count).
- Light theme is the harder case. Check it early, not as a final pass.

## Process rules
- Builders: edit files only. NO `git` (add/commit/checkout/push), NO `npm run registry:build`, NO deploys. The orchestrator holds the commit boundary and runs registry:build after each wave.
- Never verify against `npm run dev` (Turbopack serves corrupted chunks under parallel load). Never verify against a standalone harness that re-implements the draw call — verify in the real route only.
- `npx tsx scripts/verify.ts` fails (`__name is not defined`) — use `npm run verify`.
- Never touch a file owned by another builder. One component per builder.
- Scope tripwire: surface, do not write — user-facing marketing copy claims, pricing numbers, guarantees, statistics/social proof figures, legal claims. Use obvious placeholder text.
