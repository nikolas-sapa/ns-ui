# roller-break-reduce

- **slug:** roller-break-reduce
- **tier:** core

## Product surface
A multi-stage progress/pipeline indicator (e.g. "processing: stage 1 of 4",
build/compile pipeline, data ingestion funnel) — replaces a segmented
progress bar or step indicator.

## The real mechanic
Roller milling's break system: grain passes through a sequence of paired
corrugated rollers (B1 through B4 in a typical mill), each pair spinning at
a differential speed (the "fast" roll turns ~2.5x the "slow" roll) so the
nip shears rather than crushes the kernel. Each break stage narrows the roll
gap and increases corrugation fineness, and after each break the stock is
sifted, with coarse material recirculated to the same break and fine
material passed to the next. Source: standard flour-mill break-and-reduction
diagram (B1-B4 break rolls feeding sequential reduction rolls).

## Mechanic description
A stream of particles narrows in size each time it passes through a roller
pair, moving left to right through 3-4 visibly distinct roll stages.

## Rendering approach
DOM + CSS transforms for the roller pairs (fixed geometry, cheap), 2D canvas
overlay for the particle stream. Stage count and roller diameter derive
from the container's smaller dimension: 3 stages if min(w,h) < 280px, else
4. Roller diameter = min(w,h) × 0.14.

## Real numbers
- Particle feed rate: 3/s at the left edge, size 8-10px (coarse).
- Roll pair rotation: slow roll 0.6 rev/s, fast roll 1.5 rev/s (2.5:1
  differential, matches the real ratio) — rendered as a corrugation pattern
  (fine ridges, 2px pitch) rotating on each roller's rim so the differential
  speed is visible without needing to track individual teeth (avoids the
  round-9 strobe trap: corrugation pitch × rotation rate stays under 8Hz
  apparent ridge-crossing frequency, well below paint rate).
- Each stage reduces particle diameter by ~35% (matches real break-system
  reduction ratios) and increases particle count 1:2 (kernel breaks into
  fragments): stage 1 exit ~6.5px, stage 2 ~4.2px, stage 3 ~2.7px, stage 4
  ~1.8px (if 4 stages present).
- Inter-stage travel time: 900ms per gap.
- Nip pass event: a brief (150ms) flattening deformation as each particle
  crosses the roll gap, not an instant size-swap — the transform must show
  compression, not a cut.
- Steady-state particle count on screen: 25-35 across all stages combined.

## Resting loop
- t0: particles distributed across all stages at varying sizes, rollers
  mid-rotation at arbitrary phase.
- 2.5s: at least one full stage-1-to-exit transit has completed for some
  particle (visible size reduction across the full stage sequence);
  roller corrugation phase visibly advanced.
- 5s: particle population has fully turned over at least once from t0's
  specific set; rollers have completed several full rotations at their
  differential rates (fast roll visibly further around than slow roll
  relative to t0).

## Reduced-motion freeze
Freeze mid-nip at stage 2: a particle caught in compression between the
roll pair, with the full size-reduction gradient already visible across the
other stages (large particles pre-stage-1, progressively smaller through
stage 3/4) — one frame that shows the entire reduction pipeline at once.

## Interaction
None required for ambient use. If used as a determinate step indicator, an
`activeStage` prop may highlight one roll pair via a luminance boost
(brighter foreground tone) on that stage's corrugation — must NOT use
`--ns-accent` for the active-stage cue; luminance only.

## Light vs dark
Rollers rendered as `--ns-muted`-toned cylinders with `--foreground`
corrugation ridges (never `--border` as a fill — separator role only,
reserved for the thin stage-boundary hairlines). Particles are
`--foreground` at full opacity regardless of theme; check in light theme
that the corrugation ridge contrast against the roller body doesn't fall
under ~1.5:1 (bump ridge luminance offset if it does).

## Legibility
The one thing to follow: a single particle's size shrinking as it crosses
each roll pair in sequence. Cadence: 900ms per inter-stage gap plus a 150ms
nip pass — under a second per stage, roughly matching the round-9 "about a
second between discrete events" guidance, with the nip's compression
motion (not a blink) selling the transition.

## Kill criteria
Reject if: the size reduction reads as a instant swap rather than a
compression (fails the "transition must show departure and arrival"
guidance); if 4 stages compressed into a card-scale container becomes
illegible clutter (drop to 3 stages, and if still cluttered at the smallest
supported card size, kill); if the corrugation rotation aliases at any
supported frame rate (verify explicitly, this is the exact failure class
round 9 documented); if a side-by-side against `registry/loud/sieve-throw`
reads as "the same grain-size-reduction beat, rotated 90°" rather than a
distinct machine — sieve-throw's grains pass or fail a static mesh
aperture under gravity (a passive threshold gate, driven by an interactive
query); this component's particles are actively deformed by a moving nip
between two counter-rotating corrugated rollers (a continuous, ambient,
non-interactive compression). If the nip-compression beat doesn't survive
as visually distinct from mesh-passage at a glance, kill this one.
