# wasp-nest-envelope

**tier:** loud

**product surface it replaces:** full-bleed hero/background texture (the
"organic layered material" full-bleed slot alongside `weld-pool`, distinct
from either — a paper/fiber material rather than metal or ink).

**the real mechanic, with source:** Paper wasps (Polistes, Vespula) build
nest envelopes by scraping wood fiber, chewing it into pulp, and laying it
down in short fan-shaped strokes — each stroke a wasp's mandible sweep,
slightly overlapping the previous one, building up in concentric shingled
layers (like roof shingles or stucco passes) around the comb, with each
layer's stroke direction and pulp batch shade subtly different because
different wasps forage different wood sources at different times
(documented in Vespidae nest-architecture studies — e.g. Jeanne 1975 "The
adaptiveness of social wasp nest architecture").

**one-sentence mechanic description:** A paper envelope grows outward in
shingled fan-strokes, layer over layer, each layer's stroke direction and
tone slightly different from the last, building a visibly banded shell
around a hidden comb.

**rendering approach:** 2D canvas, full-bleed. A growth "shell" is modeled
as a set of concentric rings around one or more nucleation points (2-3
per typical card width). Each ring is built from discrete stroke primitives
(short filled arcs, ~14-22px long, 5-7px wide) rather than a continuous
path, so overlap/shingle structure is visible.

**REAL NUMBERS:**
- Nucleation points: `round(min(w,h) / 340)`, minimum 1, each spawns its own
  independent shell.
- Stroke size: length 14-22px (random), width 5-7px, drawn at ~14° rotation
  offset from the previous stroke in the same layer (fan pattern).
- Stroke rate: 3.4 strokes/s per active nucleation point.
- Layer radius step: each full layer (strokes covering 360° around the
  current radius) adds ~9px to the shell radius; a layer takes
  `ceil(2*PI*r / strokeSpacing) / 3.4` seconds to complete, strokeSpacing =
  11px along the ring's circumference.
- Layer tone: each completed layer is assigned a fixed lightness offset
  sampled once, ±8% around the base `--ns-muted` value (implemented as an
  alpha/luminance multiplier on the token, never a hue shift), so bands read
  as visibly distinct pulp batches once several layers are stacked.
- Shell growth continues until radius reaches `1.15 * min(w,h)/2` (envelope
  fully covers the card at rest scale) — at these rates that's ~40-70s for a
  typical hero, meaning the FIRST full envelope close is a slow background
  event, not the primary resting-loop signal (see below for what's alive at
  a glance).
- Independent of shell radius, a cutaway wedge (60-90°, one per nucleation
  point) is permanently omitted from the outermost 2-3 layers, exposing the
  banded interior structure at all times — this is the primary always-
  visible tell that layering is happening, not just a filled blob growing.
- Every 5-8s, a fresh stroke batch (a "wasp visit") sweeps across the
  cutaway's exposed inner layers specifically — the newest partial layer
  visibly gains 6-10 strokes right at the growth front inside the cutaway,
  giving a fast, local, always-visible event even while the overall shell
  radius creeps glacially.

**resting loop (t0/2.5s/5s):** t0 shows a small cluster of strokes near each
nucleation point, cutaway already exposing the (thin) interior. At 2.5s
several layers are stacked with visible banding, and a stroke-batch may be
mid-sweep. At 5s the shell is visibly larger with more banded layers and the
cutaway's exposed front has advanced — genuinely different geometry at each
mark, driven by the always-running per-nucleation-point stroke accumulation
even though full-shell closure is a much longer-period background event.

**reduced-motion freeze frame:** a shell frozen at a radius covering ~55% of
its target growth, with 5-6 visible banded layers and the cutaway exposing
clear internal banding — named `SHELL_MIDGROWTH`, chosen because it's the
frame that most legibly shows both the shingle-stroke texture AND the
layered banding at once (too early shows no banding, too late hides the
cutaway's interior detail behind its own advancing front).

**interaction:** none; ambient full-bleed background behind headline copy.
Must NOT tint any layer band with `--ns-accent` — band-to-band contrast is
luminance-only variation on `--ns-muted`/`--border`.

**light vs dark:** strokes fill with `--ns-muted` (interior/older layers) up
to `--border` (outermost, freshest layer, closer to background), with the
cutaway interior walls stroked in a thin `--border` line so the cross-
section reads in both themes without ever touching `--foreground` (keeps
this a background layer, not competing with overlaid headline text)
—verify in light theme that the layer-band lightness offsets stay
distinguishable against `--background` (may need to widen the ±8% band to
±12% in light where the token range compresses).

**kill criteria:** if the banding isn't visible at typical card/hero
viewing distance (i.e., all layers read as one flat texture), or if the
cutaway reads as decorative rather than structurally motivated, cut it.

**legibility:** the one thing to follow is the stroke-batch sweeping the
cutaway's exposed growth front every 5-8s (individual fan strokes landing
one at a time at 3.4/s, so a viewer can watch strokes accumulate); the
slower whole-shell radius growth and layer banding reward a longer look but
aren't the primary per-glance cue.
