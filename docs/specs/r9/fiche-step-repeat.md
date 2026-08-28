# fiche-step-repeat

**tier:** core

**product surface it replaces:** gallery / thumbnail grid — populates instead
of fading or masonry-settling in.

**the real mechanic, with source:** COM (computer output microfilm) and
document microfiche production used a step-and-repeat camera: a single frame
is exposed onto the film at a fixed reduction ratio (common ratios 24x for
standard COM fiche, up to 42x/48x for ultra-high-reduction), the film stage
then steps by a fixed pitch to the next position in a strict raster order
(left to right along a row, then down a row, matching the fiche's printed grid
— commonly a 7×14 or similar grid yielding ~98 frames per fiche), and an
index strip along the top edge of the fiche is exposed separately with
title/range text once the body grid completes. Each frame exposure is a short
flash (historically on the order of tens of milliseconds under a xenon or
tungsten source); the mechanical step between frames is the slower part of the
cycle. Source: COM/microfiche production process (step-and-repeat camera,
reduction ratio, index strip), standard archival imaging documentation.

**one-sentence mechanic description:** a thumbnail grid fills in strict
raster order, one cell at a time, each cell landing with a brief exposure
flash before the camera steps to the next position, then a header strip
labels the finished sheet.

**rendering approach:** DOM grid (CSS grid, no canvas needed) sized to the
container's smaller dimension — cell count derives from
`floor(smallerDimension / 64px)` per axis, clamped to a minimum 4×3 and a
maximum matching real fiche proportions (roughly 7 wide × 5 tall for typical
card aspect ratios). Each cell renders a caller-supplied thumbnail/image or a
built-in placeholder (a faint content silhouette) if none is provided.

**REAL NUMBERS:**
- step pitch: cells populate in raster order (row-major), one cell every
  850ms — decoupled/slowed from the real mechanical step-and-repeat rate
  (which is dominated by the stage's mechanical settle, not the flash itself)
  specifically to keep the sequence followable at a glance, per round-9 rule
- exposure flash: each cell's arrival is a 120ms flash to +12% luminance over
  its settled value, then relaxes to rest over 280ms (this is a genuine flash,
  not a fade-in — the cell is at zero opacity the frame before, full geometry
  the frame the flash starts)
- index strip: once the full grid has populated (raster complete), a header
  bar above the grid (reduction ratio + frame count, e.g. "24× · 35 FRAMES")
  types in left-to-right over 600ms, monospace, one character reveal every
  ~17ms
- full-sheet hold: 1.4s pause once the index strip finishes
- reset: the grid does not fade out — it steps back to blank in the SAME
  raster order it filled in (this mirrors nothing in the real process, which
  never runs backward; it exists purely to make the loop's reset itself
  readable as "the same sequence, undone" rather than a jump-cut), 400ms
  total, then the cycle restarts

**the resting loop:** t0 = grid blank except cell (0,0) mid-flash. t=2.5s =
roughly half the grid populated (raster order clearly visible as a diagonal
front of filled vs. empty cells), several rows ahead complete. t=5s = full
grid populated, index strip typed in, in its 1.4s hold — visibly a different
state (full vs. half-full) from both t0 and 2.5s. Loop period ≈ (cellCount ×
850ms) + 600ms + 1.4s + 400ms, e.g. ~7.4s for a 5×7 grid.

**reduced-motion freeze frame:** the full-sheet hold frame — every cell
populated at rest luminance (no flash), index strip fully typed. Most
structured, most information-dense frame.

**legibility:** the ONE thing to follow is the raster front — which cells are
filled vs. still empty at any instant traces a clean diagonal-ish line moving
row by row. 850ms per cell keeps consecutive arrivals distinguishable as
discrete events rather than a blur, satisfying the round-9 "roughly a second
between events" rule.

**interaction:** hover/focus on a populated cell may brighten it slightly
(luminance only) to confirm it's a real target if the grid links out
somewhere; it must NOT restart or interrupt the raster sequence on hover — the
loop is autonomous and input must not perturb its cadence.

**light vs dark theme:** unpopulated cells render as a bare `--border` outline
box (no fill) in both themes. The flash is a luminance boost relative to the
cell's own settled fill — in light theme this means darkening slightly
less headroom is available, so the flash amplitude may need to drop to ~+8%
in light theme to avoid clipping against near-white thumbnails; check this
early.

**kill criteria:** if the raster-order fill reads as "random cells popping
in" rather than a legible sweep once built, the sequencing is broken and this
is a reject. If the index-strip typing feels like a bolted-on afterthought
rather than integral to the sheet completing, cut it rather than ship it half
-realized.
