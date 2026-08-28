# ropewalk-lay-twist

**tier:** core

**product surface it replaces:** ambient card background (adjacent to
`background-ascii-wake`/`float-ribbon-draw` — a literal, non-ASCII
processing-in-progress background, e.g. behind a shipping/build/queue card).

**the real mechanic, with source:** Rope laying in a ropewalk (traditional
cordage manufacture). Three pre-twisted yarns (each individually twisted
Z-direction) are drawn together at a "top" — a grooved, cone-shaped guide —
where a counter-rotation (S-direction closing twist) locks them into a
single laid rope. The opposing twist directions between yarn-twist and
rope-lay is what keeps the finished rope from kinking (torque-balanced
construction), and the lay length (the pitch of one full helical turn) is a
controlled ratio to rope diameter, conventionally 6-8x diameter. The
finished rope is hauled away and wound onto a take-up drum as it forms.

**one-sentence mechanic description:** Three strands spiral together at a
fixed convergence point into one rope, which is continuously hauled off and
coiled onto a drum that never stops accumulating turns.

**rendering approach:** 2D canvas. Convergence point ("the top") fixed at
~30% width from the left edge, geometry (strand radius, drum radius)
derived from `min(w,h)`. Each strand is a parametric helix drawn as a
stroked path; the laid rope past the top is a single thicker stroked path
with a subtle periodic luminance ripple (one ripple per lay-length) to read
as twisted, not braided-flat.

**REAL NUMBERS:**
- 3 strands, 120° apart, each drawn as `x = top - t*feed, y = center +
  strandR * cos(phase + t*k), z-order alternates by cos sign` (2.5D
  over/under via draw order, not real depth).
- Lay length `L = 64px` (one full helical period along the feed axis).
- Feed (haul-off) speed `FEED = 18px/s`.
- Convergence-point rotation `ω = 2π * FEED / L ≈ 1.77 rad/s` (~0.28
  rev/s, one full turn every ~3.55s) — well under any strobe risk against
  60Hz paint.
- Drum: radius `min(w,h) * 0.12`, rotates at the same `ω`; each rope
  revolution deposits one new wrap-arc (`stroke` of ~6px width) on the
  drum's current layer. A layer holds `floor(2π*drumR / 6px)` wraps before
  starting a new layer 6px further out (drum radius grows slowly, capped at
  `drumR * 1.6`, then the oldest/innermost layer fades out over 2s to make
  room — an unbounded loop, never a hard reset).

**resting loop (t0/2.5s/5s):** t0: 3 loose strands entering from the left,
first wraps just landing on the bare drum. At 2.5s: drum has ~7 visible
wraps in a partial first layer, rope strand phase has advanced ~3/4 turn.
At 5s: a second wrap layer has started outward, drum silhouette visibly
thicker than at t0 — the accumulation is the primary "alive" signal, not
just the twist rotation.

**reduced-motion freeze frame:** named `LAY_QUARTER_PHASE` — strand phase
at π/2 (the most visually separated moment, all three strands maximally
distinct before they converge), drum shown with 2 partial layers already
wound so both the twisting mechanism and the accumulation are legible in
one static frame.

**interaction:** none; ambient background only. Must NOT tint the
convergence point or drum with `--ns-accent` — the twist-lock point is
structural, not an interactive highlight.

**light vs dark:** strands drawn in `--foreground` with per-strand opacity
(nearest strand ~0.9, far strand ~0.5, via draw-order alpha) against
`--background`; drum outline and layer-boundary hint use `--border` at its
native low contrast (a separator, not a fill) — checked in light theme that
the accumulating-layer read still comes from stroke density, not from
`--border` carrying any load-bearing contrast.

**kill criteria:** if the drum's growing wrap count isn't visually
distinguishable from a static coil at card scale, or if the twist reads as
a fixed braid pattern rather than a rotating convergence (i.e. nothing
changes if you stop watching the drum) — reject.

**legibility:** the eye follows the single point where 3 strands converge
into 1 rope, completing one visible rotation every ~3.55s; the drum's
wrap count climbing over the following seconds is the secondary, slower
confirmation that the rope is actually being laid, not just spinning in
place.
