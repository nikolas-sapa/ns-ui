# turbidite-graded-bed

- **slug:** turbidite-graded-bed
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces (Filter 1)
Timeline / activity log — an ambient "history is accumulating" strip, nearest siblings
`timeline-changelog-wave` and `growth-ring`, differentiated by mechanism: this deposits one
graded LAYER per discrete flow-pulse event (continuous, unforced, ambient) with a real
fining-upward internal structure per layer, versus `growth-ring`'s one-ring-per-user-save
(driven by real edit history, not an internal clock) and `scroll-story-strata`'s scroll-
driven drill descent through a pre-existing static bank (loud, viewport-pinned, interaction-
driven, not an accumulating record).

## The real mechanic
A turbidity current is a fast-moving underwater density current of sediment-laden water that
flows down a submarine slope, triggered episodically (a slope failure, a flood pulse reaching
a river mouth's delta front) rather than continuously. As one of these currents decelerates
and loses competence, it deposits its load in a single, predictable internal sequence within
minutes to hours: coarsest material (sand, granules) settles first at the base, then
progressively finer material (silt, then clay) settles as the current keeps slowing, so a
single event leaves one GRADED BED — coarse at the bottom, fining continuously upward to a
clay cap — stacked directly on top of the previous event's bed with a sharp, erosive basal
contact where the new current scoured slightly into the old mud cap below it. Repeated over
many events, this builds a submarine fan's stratigraphy as a stack of graded beds (a
"Bouma sequence" in the geological literature), each one a legible record of one flow event's
strength and duration.

## One-sentence mechanic description
Each pulse deposits one new layer at the top of the stack that fines continuously from a
coarse, sharp base to a fine cap, and the stack keeps growing pulse by pulse, oldest layers
compressing slightly as new ones pile on above them.

## Rendering approach
2D canvas, vertical strip (accumulates upward like the timeline sibling it replaces). Each
layer is drawn as a fixed-width band whose HEIGHT is set at deposit time (proportional to
that pulse's flow strength, randomized per event) and whose internal texture is a vertical
gradient of grain-size dots: dot density high and dot radius large at the layer's base,
smoothly decreasing in both density and radius toward the layer's top (this is the fining-
upward signature — render as a per-layer canvas draw at deposit time, cached, not
recomputed every frame). Layer count visible at once derived from container height /
average layer height; older layers scroll/compress toward the bottom as new ones are added,
matching a real stratigraphic column reading bottom-old to top-young.

## Real numbers
- Pulse interval: a new flow event fires on an irregular schedule averaging **1 event per
  3.2s** (exponential-ish spacing, 1.8-5.5s bounds) — irregular by design, since real
  turbidity currents are triggered by discrete slope-failure events, not a metronome.
- Deposit animation: each layer doesn't snap in — it draws over **450ms**, the coarse base
  appearing first (0-120ms) and the fining sequence sweeping upward through the layer's own
  height over the remaining 330ms, so a viewer can watch one layer's internal grading form
  in real time, not just see a completed band appear.
- Basal scour: the instant before a new layer starts drawing, the top ~2-4px of the
  previous (now-buried) layer's cap is visibly notched/eroded (a small irregular scallop, not
  a straight line) over **80ms** — the real erosive-base signature, distinct from a flat
  stacking seam.
- Layer height: 14-34px per event at card scale (randomized per pulse, proportional to a
  per-event "strength" scalar drawn from a skewed distribution so most events are modest and
  occasional ones are large — real turbidites vary by an order of magnitude bed-to-bed).
- Compression: layers older than the visible window's bottom 20% compress their rendered
  height by **0.3%** per subsequent event (capped at 40% total compression) — a slow,
  continuous squeeze from the growing overburden above, visible only over many events but
  present from the first one.
- Column overflow: once accumulated height exceeds the visible strip, the strip scrolls
  content downward (oldest layers exit the bottom) at the same rate new layers are added, so
  the column never overflows or needs a reset — this is what keeps the loop genuinely
  unbounded.

## The resting loop
- **t0:** an arbitrary mid-column frame — several complete graded layers stacked, no active
  deposit in progress, one layer's basal scour visible from its most recent burial.
- **2.5s:** at least one new pulse will typically have fired (mean interval 3.2s, so roughly
  even odds by 2.5s) — either a layer mid-deposit (fining sweep visibly in progress) or a
  freshly completed one with a visible scour notch that wasn't there at t0.
- **5s:** column visibly taller (or, once scrolling engages, visibly different top-to-bottom
  content) with at least one full new pulse cycle (scour, deposit, settle) completed since
  t0, and micro-compression measurably applied to the oldest visible layers.

## The reduced-motion freeze frame
Freeze immediately after a deposit completes, before the next pulse's scour begins (freshly
graded layer fully formed and visible, base sharp, cap fine, sitting cleanly atop the
previous layer's own scour line) — the single most structured frame, showing one full graded
sequence at maximum legibility.

## Interaction
None required. If added: hovering a layer could report its relative "flow strength" (the
scalar that set its height) — must not pause the pulse timer and must not tint any layer
with `--ns-accent`.

## Light vs dark theme
Grain-density dots render in `--foreground` at per-dot alpha tied to local grain size (larger
basal grains at higher alpha, fine cap grains at low alpha) against a `--background` layer
fill; `--border` marks each layer's basal scour line only (a genuine separator use, thin and
functional, not a fill). In light theme, confirm the finest-cap alpha step doesn't fall below
the perceptual floor — widen the low end of the alpha ramp rather than switching to a flat
color for the cap.

## Kill criteria
- If a layer's internal fining gradient isn't legible as "coarse bottom to fine top" at card
  scale (i.e. it just reads as a solid-colored band), kill it — the graded structure inside
  each layer is the entire mechanic, not the stacking itself.
- If the basal scour notch isn't distinguishable from a plain flat stacking seam in an actual
  screenshot, kill it — a flat seam makes this indistinguishable from a generic accumulating
  bar-stack.
- If it reads as a restyle of `growth-ring`'s ring-per-save mechanic once built, kill it — the
  internal per-layer grading and the irregular pulse-driven (not user-action-driven) timing
  must be the primary read.
