# Round 8b — builder brief

You build ONE component. You never touch another builder's files.

## Read first
- `docs/specs/r10/BRIEF.md` (the token rules and filters are binding)
- `docs/showpiece-recipe.md`
- your own spec: `docs/specs/r10/<slug>.md`
- a shipped sibling of the same tier for file shape + meta.json format, e.g.
  `registry/core/auxin-canal/` (component.tsx, demo.tsx, meta.json)

## Deliverable
`registry/<core|loud>/<slug>/` containing:
- `component.tsx` — self-contained, zero new dependencies, "use client" where needed
- `demo.tsx` — the catalog demo wrapper, mirroring a sibling's shape
- `meta.json` — name, title, description, collection, tags, useWhen, autoplay,
  `instruction` (a long, precise, implementation-level paragraph like the sibling's),
  dependencies: []

`useWhen` must name at least one existing sibling component to pick INSTEAD, and why.
`autoplay.mode` — use `"none"` unless a real pointer/press/scroll input is what makes it
move; a press that latches an irreversible state (opened curtain, revealed panel) must be
`"none"`, that bug shipped last round.

## Binding rules (each earned by a real bug)
- Zero colour literals anywhere, including fallbacks and GLSL. Read tokens with
  getComputedStyle(document.documentElement) + a MutationObserver on its class.
  **No paint before the first token read** — check rAF start, ResizeObserver AND
  IntersectionObserver resume paths specifically.
- `--border` is a separator token (~1.1:1 contrast in light theme) — never a fill or stroke.
- `--ns-accent` is interaction chrome only. Never the climactic moment. Pointer highlights
  move in luminance only — never mix accent into a highlight.
- Alive at rest: visibly different at t0 / 2.5s / 5s with zero input, unbounded loop.
- `prefers-reduced-motion` freezes on a deliberately chosen NON-t0 most-structured frame.
- Derive geometry from the container's SMALLER dimension so it reads at card scale.
- Canvas needs `w-full h-full` or JS-set style dimensions, or it falls back to intrinsic size.
- Check LIGHT theme early, not as a final pass. It is where value-only readability breaks.
- Clean up on unmount: cancel rAF, disconnect every observer, drop WebGL context.

## Kill your own work
If the component does not clear the two taste filters (names a real product surface;
striking and alive at rest), say so and stop rather than shipping something mediocre.
Report a kill as a kill — that is a successful outcome, not a failure.

## Do NOT
- run `registry:build`, `npm run verify`, or any git command (the orchestrator does those)
- edit anything outside your own `registry/<tier>/<slug>/` directory
- add a dependency

## Report back
slug, tier, files written, the resting loop in one sentence, the reduced-motion freeze frame
you chose, and anything you are unsure about.
