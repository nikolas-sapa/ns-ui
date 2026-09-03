# The round playbook

How to run a full component round with parallel agent teams — sourcing,
briefing, building, and verifying — distilled from round 8a, which produced
a working set of new components using this process end to end. Read
`docs/showpiece-recipe.md` for what makes a single showpiece pass owner
review, and `docs/review-workflow.md` for the review/verify routes and gate
mechanics; this document is the layer above both — how to run the round
that produces the components those two docs judge.

## 1. Sourcing — two axes, one anti-pattern

Everything worth building in round 8a came from two axes:

- **Rendering TECHNIQUE, not subject.** The registry's ~62 ASCII slugs all
  share one pattern (simulate a scalar field, map luminance through a ramp
  glyph, keep 85-97% of cells empty) — "which field to simulate" is
  exhausted. The open axis is the technique itself: sub-cell grids,
  dithering algorithm families, display-hardware artifacts, print
  reproduction.
- **Real physical/industrial/print PROCESS.** Same pull as `weld-pool`,
  `dye-whorl`, `flyback-tear` in the showpiece recipe — a mechanic borrowed
  from something that actually exists, not invented cold.

**Documented anti-pattern: web search for trend surfaces.** Searching
"award site preloader 2026" or "kinetic typography trends" returns Framer
marketplace listings, Envato templates, and SEO blog posts — not real
mechanics. This is the traceable failure mode that got two components built
and then removed from this repo. Don't source from trend search.

**Scouts filter concepts BEFORE proposing them**, against:

- Monochrome-native only — a concept whose identity IS its hue dies. Steel
  tempering colours was dropped for this.
- No settings/admin/config surfaces — auto-reject per
  `docs/showpiece-recipe.md` Filter 1. This killed a railway-interlocking
  concept whose mechanic was otherwise excellent.
- No API rate-limiting/quota/credits territory — owner preference.
- An unforced, unbounded resting loop. A process that finishes and stops
  fails Filter 2 (alive at rest) in the showpiece recipe.

## 2. The spec-then-build split

Research agents source and rank concepts, then write build-ready specs with
real numbers — rates, counts, thresholds, freeze frames — before any
builder starts. Builders get one component each and never share files.

**Research agents have no write tool in this setup.** A full report can
come back with nowhere to save it. A write-capable agent (the orchestrator,
or a dedicated scribe agent) must persist specs on the researcher's behalf
— don't assume the research agent can write its own output to disk.

## 3. The builder brief

Every builder prompt should carry the accumulated bug list below — the
failure rate dropped as the round went on specifically because later
builders got more of this list up front. Each item was earned by a real
bug this round:

- **Zero colour literals, including fallbacks.** Tokens read via
  `getComputedStyle` + a `MutationObserver`, and **no paint before the
  first read** — trace the rAF start, `ResizeObserver`, and
  `IntersectionObserver` resume paths specifically. Two agents this round
  assumed no early-paint path existed and were wrong.
- **`--border` is a separator token**, 1.19:1 contrast in light theme
  (`#ebebeb` on `#ffffff`, computed) — invisible if used as a fill or stroke
  colour.
- **`--ns-accent` is interaction chrome only** (buttons, focus rings).
  Do not reach for it on a component's one climactic moment — see the
  showpiece recipe's "accent-tinted pointer highlights" standing check for
  why this is the single most repeated defect on the project.
- **`--ns-muted` is a second ink at full strength, never a variable-strength
  wash.** Its ceiling is theme-dependent (8.45:1 light, 6.12:1 dark), so a
  mid-strength wash looks fine in both themes and only breaks later, in dark
  first, when someone strengthens it. Full strength, or `--foreground` at an
  explicit alpha.
- **Alive at rest** means visibly different at t0/2.5s/5s with no input.
- **`prefers-reduced-motion` freezes on a deliberately chosen NON-t0**
  most-structured frame.
- **Derive geometry from the container's smaller dimension** so it reads at
  card scale, not just full-bleed.
- **A canvas needs `w-full h-full`** or JS-set style dimensions, or it
  falls back to its intrinsic size.

## 4. Tell builders to kill their own work

Several briefs this round said: if, after reading the nearest existing
component, you conclude yours is a restyle, say so and stop. This worked —
concepts died for good reasons instead of shipping and being pulled later.
Two hero concepts were cut at spec stage on exactly this instruction.

## 5. The orchestrator holds the commit boundary

Builders were forbidden `git` and `npm run registry:build` this round, per
`~/.claude/rules/agents.md`'s "commit boundary stays with the orchestrator."

**Consequence to plan for:** forbidding `registry:build` meant new
components were never in the generated registry mid-round, which forced a
throwaway review page (`app/r8a/page.tsx`) that later had to be deleted —
see `docs/review-workflow.md`'s "Don't do this" section, which now records
that page as a one-off, not a pattern. Better: let the orchestrator run
`registry:build` once after each wave, so `/preview/<name>` and `/review`
work for free instead of hand-rolling a demo page.

## 6. Verify in the real context, never a harness

The most important lesson of the round. An agent "fixed" a centring bug by
verifying against a standalone Playwright harness that re-implemented the
draw call, reported the assembly at "0px offset," and missed that the real
component was drawing past the bottom-right corner of its card.

Every fix must be reproduced and verified in the actual route
(`/preview/<slug>/embed`), at `deviceScaleFactor` 1 AND 2, in both themes.
Wait ~5s after `networkidle` — the demo chunk needs more than 1.6s to
hydrate, or you screenshot a blank frame and misdiagnose.

## 7. What the gates cannot see, and how each was caught anyway

- `scripts/verify.ts` screenshots at dsf 1, so a canvas intrinsic-size bug
  was invisible — correct at dpr 1, broken at dpr 2. Found by the owner on
  a Retina display.
- `verify.ts` navigates `/preview/<name>` without the autoplay parameter
  (by design — see `docs/review-workflow.md`'s "three routes"), so it can
  never see an autoplay-latched card. Three curtains recorded their
  revealed-empty state; found by a runtime audit, not the gate.
- A component can pass every gate and still be visually dead — one
  component was pixel-identical for 70s despite a green gate.

**Prescribe the runtime audit as a standing step for every round:** render
every component's real card at both scale factors, hash the framed element
over 40+ seconds, and compare the canvas box against its parent.

## 8. Static checks are proxies — verify the property, not the pattern

A grep for canvases with `absolute inset-0` and no `w-full h-full` produced
seven suspects; all seven were false positives (`position: static` with
inline sizing). The auditor then ran the actual property at runtime — every
canvas's bounding box against its parent's — which can't be fooled by a
sizing mechanism nobody thought of. Zero real overflows.

**Rule: when a static grep flags a defect class, confirm it with a runtime
measurement of the actual property before acting on it.**

## 9. The owner is the last gate

Feedback comes through `/review` verdicts and notes persisted to
`.review-state.json` (see `docs/review-workflow.md`). Five components were
cut this round after passing every automated check. Judged rows are hidden
by default on `/review` — an empty review page means the round is
approved, not broken.

## Known traps

- Don't verify against `npm run dev` — Turbopack serves corrupted chunks
  under parallel load (measured 15-50% false failures vs. 0/12 against a
  production build).
- A server started with `&` in one shell call dies when that call returns.
  Start and verify in a single invocation, or use pm2.
- `npx tsx scripts/verify.ts` fails with `__name is not defined` — use
  `npm run verify`.
- A production `next start` will not see new routes or components without
  a rebuild and a pm2 restart.
- A high pm2 restart count is cumulative, not a crash-loop signal — check
  `unstable restarts`, not just the raw count, before believing it.
