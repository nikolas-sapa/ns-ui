# vacuum-filtration-cake-build

- **slug:** vacuum-filtration-cake-build
- **tier:** core (card-scale canvas)

## Product surface it replaces
A progress/processing indicator — an alternative to a generic upload or
processing progress bar.

## The real mechanic
Büchner-funnel vacuum filtration: liquid drips through a filter paper into
a receiving flask while a solids "cake" builds on the paper's surface. Under
constant applied pressure, filtration rate decays as the cake thickens per
Darcy's law (flow rate ∝ 1/cake resistance ∝ 1/thickness) — visible as the
drip cadence steadily stretching out.

## One-sentence mechanic description
Liquid drips through a filter as a solids cake builds on the paper, the
drip rate visibly slowing as the thickening cake adds resistance.

## Rendering approach
2D canvas. Funnel and flask geometry derive from `min(width, height)`. Cake
modeled as a growing radial height-field (semicircular profile in cross
section) centered on the filter paper disc.

## Real numbers
- Cake thickness follows `dh/dt = k/h` (constant-pressure Darcy filtration),
  `k` tuned so cake height grows from 0 to 38% of the funnel radius over a
  14s fill cycle.
- Drip interval starts at 0.6s/drop (t0, thin cake) and stretches to
  2.4s/drop by cycle end (thick cake) — a 4x slowdown sampled continuously
  from the `1/h` relationship, not a fixed schedule.
- Each drop adds 5px to the flask's liquid level.
- At 14s, vacuum releases: a brief bubble-burst animation (0.4s) plays,
  cake and flask fade out over 1.5s, and the cycle restarts. Full loop:
  ~16s, unbounded.

## The resting loop
- **t0:** cake at 0, first drop falling, flask empty.
- **2.5s:** cake ~10% built, ~4 drops fallen, drip interval up to ~0.9s,
  flask liquid visibly risen.
- **5s:** cake ~22% built, drip interval ~1.3s — noticeably slower than the
  t0-2.5s interval, flask liquid higher still.

## Reduced-motion freeze frame
Freeze at the **60%-through-cycle frame** (t=8.4s): cake at ~28% height, a
droplet frozen mid-fall just below the funnel stem — the most structured
frame, showing cake buildup, flask level, and an in-flight drop together.

## Interaction
None; ambient only.

## Light vs dark theme
Cake renders as a `--ns-muted`-to-`--foreground` luminance ramp, densest at
its center. Liquid is a translucent `--foreground` fill in the flask. The
funnel/flask glass outline uses `--border` at low opacity strictly as a
non-load-bearing rim — never as the fill or stroke carrying the cake or
liquid.

## Kill criteria
If the drip-rate slowdown between t0 and t=5s is under 2x (not
perceptible), or the cake reads as a static blob with no visible growth,
reject.

## Legibility
The ONE followable thing: the interval between drops stretching out as the
cake visibly thickens. Cadence moves from 0.6s to 2.4s per drop across the
14s cycle; each drop is shown as a full departure-from-stem-to-splash arc
so the slowing is unambiguous, not inferred from a static cake shape alone.
