# Round 8b — scout + build brief

Repo: /Users/nikolassapalidis/Developer/misc/ns-ui-r9 (branch feat/r8b)

## Required reading before proposing anything
- docs/round-playbook.md (whole file)
- docs/showpiece-recipe.md (whole file)
- docs/review-workflow.md (sections on the gate)
- `ls registry/core registry/loud` — the taken slugs. Nothing may overlap an existing mechanic.

## Hard filters (auto-reject)
1. Names a real product surface it replaces (hero, background, divider, card, nav, loader,
   empty state, feedback moment, pricing, gallery, testimonial, footer). "Settings screen",
   "dashboard", "dev tool" = reject.
2. Alive at rest: visibly different at t0 / 2.5s / 5s with zero input, unforced, unbounded loop.
   A process that finishes and stops = reject.
3. Monochrome-native. If the concept's identity IS its hue, it dies.
4. No settings/admin/config surfaces. No API rate-limit/quota/credits territory.
5. Sourced from a REAL observed mechanic (physical, industrial, print, display hardware),
   never a model-invented category. No trend/web-search sourcing — documented failure mode.

## Token rules (every builder must obey)
- Zero colour literals anywhere, incl. fallbacks and GLSL. Colours read via getComputedStyle on
  documentElement + MutationObserver on its class. NO PAINT BEFORE THE FIRST READ — check the
  rAF start, ResizeObserver and IntersectionObserver resume paths.
- `--border` is a separator token (~1.1:1 in light) — invisible as a fill/stroke.
- `--ns-accent` is interaction chrome only (buttons, focus rings). Never on a component's
  climactic moment. Pointer highlights move in LUMINANCE only.
- prefers-reduced-motion freezes on a deliberately chosen NON-t0 most-structured frame.
- Derive geometry from the container's smaller dimension so it reads at card scale.
- A canvas needs w-full h-full or JS-set style dimensions.
- Light theme is the harder case — check it early, not as a final pass.

## Spec format (one file per concept, docs/specs/r9/<slug>.md)
- slug, tier (core = card-scale DOM/canvas, loud = full-bleed showpiece)
- product surface it replaces (Filter 1 answer, one line)
- the real mechanic, with the source it is borrowed from
- one-sentence mechanic description (hard format, user-facing)
- rendering approach: DOM / 2D canvas / WebGL; grid size or resolution rules
- REAL NUMBERS: rates (Hz, px/s), counts, thresholds, decay constants, cell sizes
- the resting loop: what is different at t0 / 2.5s / 5s
- the reduced-motion freeze frame, named explicitly
- interaction (if any) and what it must NOT do
- how it reads in light theme vs dark
- kill criteria: what would make this component a reject

## Round 9 additions to the filters (earned in round 8b's owner review)

Only two of round 8b's sixteen came back, and both failed for the SAME reason —
legibility, not mechanism:

- **A real clock rendered literally can alias into a strobe.** meter-matrix-scan
  drove its highlight off a true 240Hz row-scan; against a ~60Hz paint that read
  as a glitch, not as multiplexing. If your mechanic's real rate is near or above
  the paint rate, DECOUPLE the visual from it: render a slow sweep and document
  the real rate rather than animating it 1:1.
- **A cadence a viewer cannot follow is a defect.** overflow-chip-mux swapped
  slots every 130ms and the owner's note was "why does it move so fast, i dont
  understand anything". If a discrete event is the mechanic, it needs roughly a
  second between events, and the transition itself must show departure and
  arrival, not a blink.

Add a "legibility" line to every spec: name the ONE thing a viewer should be able
to follow with their eye, and the cadence that makes it followable.
