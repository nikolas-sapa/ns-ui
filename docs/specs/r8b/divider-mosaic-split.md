# divider-mosaic-split

**tier:** core

**product surface it replaces (Filter 1):** section divider — a full-width
band of ambient rule/ornament between two page sections, same slot as
`divider-teletext-mosaic`, `divider-petscii-vu`, `divider-telephone-cord-delam`.

## The real mechanic

NAPLPS (North American Presentation Level Protocol Syntax — the videotex
standard behind Prestel, Telidon, and early consumer online services'
graphics mode) and the teletext alphamosaic character sets it descends from
both address a 2-wide x 3-tall sub-cell grid per character cell (the same
"sextant" addressing this registry's `divider-teletext-mosaic` already
ships). What NAPLPS adds is a second selectable attribute mode per mosaic
run: **contiguous** (lit sub-cells flush against their neighbours, forming
solid mosaic shapes — this is what `divider-teletext-mosaic`'s own docblock
explicitly built and explicitly named as the mode it chose) vs
**separated** (the same 6-bit sub-cell code, but every lit block is drawn
inset by a fixed gap on all four sides, so the mosaic reads as a field of
small floating tiles rather than a solid silhouette). Real terminals let a
page author toggle this per-attribute-byte; broadcasters used separated
mode for graphs and diagrams where individual sub-cell boundaries needed to
stay legible, contiguous for photo-like fills.

This is the specific unbuilt variant `divider-teletext-mosaic`'s own source
comment names: *"...as opposed to 'separated mosaic' which insets a gap per
block."*

## One-sentence mechanic description

A full-width divider band of 2x3 alphamosaic character cells rendered
exclusively in NAPLPS separated mode, where every lit sub-cell block sits
inset from its neighbours by a genuine luminance gap, so the band reads as
a field of small tiles rather than a contiguous shape.

## Rendering approach

2D canvas. Cell size derived from container height (divider is short and
wide — drive cell size off the smaller dimension, the band height): cell
≈ `height / 3` px so exactly 3 sub-cell rows fit vertically; column count
= `floor(width / cellWidth)`, cellWidth = cell height (square cells).
Sub-cell grid is 2 columns x 3 rows per character cell, same 6-bit
addressing as `divider-teletext-mosaic` (bit per sub-cell, 64 possible
patterns). Draw sub-cells as filled canvas rects (not a Unicode glyph
range — same reasoning as the teletext sibling: unverified glyph coverage
risks tofu).

**The gap is the entire identity of this component and must be a real
luminance gap, not a stroke:** inset each lit sub-cell rect by 18% of the
sub-cell's short dimension on all sides, so background token shows through
between adjacent lit blocks. Do NOT implement the gap as a `--border`
stroke around each block — `--border` is ~1.1:1 contrast in light theme
and would make the gap invisible exactly where it needs to prove the mode
is different from contiguous. The gap must be literal unpainted
`--background` between two `--foreground`/`--ns-muted` fills.

## Real numbers

- Sub-cell grid: 2 wide x 3 tall per character cell (matches broadcast
  alphamosaic addressing).
- Gap inset: 18% of sub-cell short dimension per side (≈36% of a sub-cell's
  width consumed by gap on a 2-wide sub-cell split — deliberately generous
  so the separated/contiguous distinction reads at card scale, not a
  hairline that anti-aliases away).
- `COLUMN_INTERVAL_MS = 90` — a write cursor sweeps left to right,
  re-sampling a slow generative field into a fresh 6-bit pattern per column
  group every 90ms (matches the cadence a real videotex page arrives off
  a byte-serial transmission line, faster than the teletext sibling's
  per-row 420ms since this sweeps columns, not full rows, across a shorter
  band).
- `PAUSE_MS = 800` — sync pause between a completed left-to-right pass and
  the next, mirroring the real per-page refresh cycle.
- A brief write flash (one column-group at full brightness for the
  duration of `COLUMN_INTERVAL_MS`) marks the leading edge of the sweep,
  same technique as the teletext sibling's row-write cursor.

## The resting loop — t0 / 2.5s / 5s

- **t0:** mid-sweep, roughly half the columns freshly written with the
  current column-group's write flash visible at the leading edge, the
  rest of the band still blank ground.
- **2.5s:** a different sweep pass entirely (a fresh 6-bit pattern
  re-sampled from the slow generative field, so the mosaic content itself
  has changed, not just the cursor position) — either mid-sweep at a
  different column, or in the `PAUSE_MS` hold between passes.
- **5s:** a third distinct sweep/pause state, proving continuous cycling
  rather than a single reveal-and-stop.

## Reduced-motion freeze frame

Freeze on a **fully-written pass mid-`PAUSE_MS` hold** — every column
filled, no write cursor or flash visible, the full separated-gap tile
structure legible edge to edge. Explicitly not t0's half-written state,
which would hide half the pattern.

## Interaction

None. This is an ambient divider, not a background field — no pointer
stir, no hover state. Must not reach for `--ns-accent` anywhere; the write
flash is a luminance brighten of `--foreground`, never accent-tinted.

## Light vs dark theme

Both themes read from the same four tokens (`--background`, `--foreground`,
`--ns-muted`, `--border` unused). Light theme is the harder case: the gap
must stay a genuine unpainted background gap at the same 18% inset in both
themes — check it isn't accidentally anti-aliased into invisibility against
a near-white background at cell sizes under ~16px. If the smaller card-scale
render collapses the gap below 1-2 physical pixels at DPR 1, floor the
inset in px, not just percentage.

## Kill criteria

- If, at any tested card width, the separated gap is not visually
  distinguishable from a contiguous fill (light theme, small cell size),
  this is a reject — it would collapse into a re-skin of
  `divider-teletext-mosaic` with no real difference.
- If the write-sweep cadence reads as identical to the teletext sibling's
  row sweep rather than a genuinely different column-wise mechanic, reject.
