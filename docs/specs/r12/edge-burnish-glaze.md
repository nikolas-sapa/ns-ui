# edge-burnish-glaze

**tier:** core

**product surface it replaces:** divider (a horizontal edge-trim rule,
adjacent to `float-ribbon-draw`/`banner-tear-stub` — a literal leather-edge
finishing process rendered as a thin structural rule).

**the real mechanic, with source:** Burnishing a leather edge — repeated
friction passes (traditionally with a wood or bone slicker, often with a
little water or wax) compact and heat-set the surface fibers until the raw
edge takes on a glassy, translucent slick sheen. The finish isn't
permanent from one pass: worked spots that go a while without a fresh pass
lose their sheen (the wax film dries, dust settles) and need reburnishing —
a working leatherworker's slicker sweeps back and forth across the whole
edge repeatedly for exactly this reason, not just once to "finish" it.

**one-sentence mechanic description:** A burnishing stroke sweeps back and
forth along a leather edge, building a glassy specular sheen with each
pass while sheen slowly dulls over time in cells the stroke hasn't
revisited recently.

**rendering approach:** 2D canvas. A 1D array of cells along the edge's
length (`CELL_PX = 6px`, count = `floor(width / CELL_PX)`), each holding a
scalar `gloss ∈ [0,1]` driving specular highlight amplitude. Edge height
derived from `min(w,h) * 0.06`, a thin structural rule.

**REAL NUMBERS:**
- `SWEEP_SPEED = 140px/s`; the stroke position is a triangle wave across
  the full edge width, so at a 320px-wide card one full there-and-back
  sweep takes `2 * 320 / 140 ≈ 4.6s`.
- `GLOSS_GAIN = +0.18` applied to any cell the stroke's ~18px-wide contact
  zone currently overlaps, per frame it's under the stroke (accumulates
  fast, saturates at `1.0` within ~1-2 passes).
- `GLOSS_DECAY = -0.004/s` continuous, applied to every cell regardless of
  stroke position (ambient dulling).
- `DULL_THRESHOLD = 0.35`: cells below this render with no specular
  highlight (matte, `--ns-muted` base only); above it, specular amplitude
  scales `gloss` linearly into highlight opacity.
- Net effect at steady state: cells near the sweep's turnaround points
  (where dwell time is highest) stay glossiest; cells mid-sweep dull
  fastest between visits — a real, non-uniform sheen gradient rather than
  a flat "shiny bar."

**resting loop (t0/2.5s/5s):** t0: stroke near one end, gloss field mostly
mid-range with light dulling gradient. At 2.5s (~half a sweep period):
stroke has crossed to the far end, cells behind it visibly brighter, cells
not yet revisited this pass slightly duller than at t0. At 5s (~1 full
sweep): stroke back near the start, the gloss field has visibly shifted
its bright/dull distribution compared to t0 — never the same static
frame twice.

**reduced-motion freeze frame:** named `SWEEP_MIDSPAN` — stroke frozen at
the center of a traversal (not at either turnaround, which is less
information-dense), gloss field showing a clear gradient from recently-
swept (bright) to due-for-a-revisit (dull) cells.

**interaction:** none; ambient divider. The stroke highlight and gloss
must be pure luminance (specular amplitude on `--foreground`/`--ns-muted`)
— must NOT use `--ns-accent` for the sweeping highlight, the single most
repeated defect this project has on record for exactly this kind of
moving highlight.

**light vs dark:** gloss reads as increased highlight-to-base contrast
(brighter peak, same `--background`), which must remain legible in light
theme where headroom above `--background` is smaller than the headroom
below it in dark theme — verified by keeping the glossy-cell peak value
close to `--foreground` itself rather than an intermediate tone, so the
distance from `DULL_THRESHOLD` cells is large in both themes.

**kill criteria:** if the gloss gradient collapses to indistinguishable
from `honing-crosshatch`'s or `lap-stroke-trace`'s existing abrasive-pass
textures (both already ship a repeated-stroke pattern) — the load-bearing
difference here is the gloss ECONOMY (gain-then-decay, uneven dwell-time
distribution) producing a non-uniform sheen gradient, not a fixed scratch
angle; if that economy isn't visually distinguishable from a static
crosshatch fill, reject.

**legibility:** the eye follows the single bright stroke sweeping back and
forth, one full traversal every ~4.6s; cells it passed several sweeps ago
visibly dulling gives the viewer a second, slower cue for "where it's
about to head back to."
