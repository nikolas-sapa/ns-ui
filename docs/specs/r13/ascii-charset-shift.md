# ascii-charset-shift — the same bytes, remapped

**Collection:** core · **Surface:** feature grid / comparison table (GAP-MAP open
gap #5 — feature grid, 6 shipped)

## 1. Surface + the real technique

**Surface replaced:** the **feature grid / feature comparison table** — GAP-MAP §4
names the miss precisely: *"a grid where the cells carry the mechanic and the grid
earns being a grid rather than being a picture with borders."* That is what this
component is. Each band is a feature row of prose; under the graphics mapping the
same bytes resolve into the row's **rules and junctions**, so the table's structure
is literally made of the text in its cells. The grid is not drawn around the
content — it *is* the content, re-read.

**Real technique:** **Select Character Set (SCS)** on a VT100-class terminal.
`ESC ( 0` designates *DEC Special Graphics and Line Drawing* into G0; `ESC ( B`
restores US ASCII. While Special Graphics is active the **same byte values render as
different glyphs**:

| byte | ASCII | Special Graphics |
|---|---|---|
| `q` | q | `─` |
| `x` | x | `│` |
| `l` `k` `m` `j` | l k m j | `┌` `┐` `└` `┘` |
| `n` | n | `┼` |
| `t` `u` `v` `w` | t u v w | `├` `┤` `┴` `┬` |
| `` ` `` | ` | `◆` |
| `a` | a | `▒` |
| `~` | ~ | `·` |

This is the mechanism `ncurses`' `ACS_*` macros sit on, and it is exactly why a
curses program on a mis-configured terminal prints `lqqqk` where a box should be.

## 2. Nearest existing slug + why this is not a restyle

**Nearest:** `loud/transition-ascii-dissolve` (a spatial dissolve front with a band
of ASCII glyph noise centred on it). Secondary, and the one a reviewer will reach
for: `core/container-box-drawing`, whose border "upgrades to a double-line border
character by character."

`transition-ascii-dissolve`'s front changes **glyph density** — the band's glyphs
are chosen off a luminance ramp, so content and appearance move together. Here the
**underlying byte buffer is identical on both sides of the front**. A cell holding
`0x71` reads `q` on the ASCII side and `─` on the graphics side; nothing about the
content changes, only its interpretation. `container-box-drawing` changes the
*characters* of a border from single to double weight — a border, and a real
rewrite. This remaps the charset of **body prose**, so a paragraph becomes a
schematic without a single byte being rewritten.

## 3. Mechanic — numbers

- **Cell:** `cellH = 15px`, `cellW` measured (GeistMono 15px → 9.00px).
- **Geometry:** each band is 80 cols x 10 rows = 150 px tall. At 720x480 the demo
  card stacks **3 bands** with 12 px gutters.
- **Buffer (authored, per band):** a fixed 800-cell byte buffer authored so it is
  *simultaneously* readable as English prose **and**, under the graphics mapping,
  resolves into a coherent box-drawing figure. Authoring rule: the figure's rules
  and junctions must land on the letters `q x l k m j n t u v w`, and the prose must
  be built from words that place those letters at the figure's coordinates. Cells
  outside the figure hold letters outside the mapped set and pass through unchanged
  in both modes. **Placeholder prose only** — no marketing claims, no statistics.
- **The front:** a vertical boundary sweeping left→right at **96 px/s** (10.7
  cells/s) → **7.5 s** per band traversal; **900 ms** hold at full-graphics; sweeps
  back right→left restoring ASCII; **900 ms** hold. Full cycle
  `2 x 7.5 + 2 x 0.9 = 16.8 s`. Unbounded, no input, no autoplay flag.
- **Band phase offsets:** 0 s / 5.6 s / 11.2 s, so the three bands are never in the
  same mode and the comparison is always on screen.
- **Front detail:** the boundary is a **3-cell-wide crossfade**, not a hard line —
  the ASCII glyph fades out at alpha `a` while the graphics glyph fades in at
  `1 - a`. This is what makes the *identity* of the substitution legible: you watch
  `q` become `─` rather than one glyph swapping for another.
- **Fill ratio:** prose runs **78%** non-space; the figure under the graphics
  mapping is **34%** ink, because rules are thin. So the band visibly *empties into
  structure* as the front passes — a 44-point coverage drop with a constant buffer.
  No density-ramp component can produce that, because in a ramp component the
  content is what changed.

## 4. t=0s / 2.5s / 5s, no input

Seeded with band 1's front at 0.28 of its width.

- **t=0s:** band 1 is 28% graphics (the figure's left edge assembled, prose to the
  right of the front); band 2 sits in its ASCII hold; band 3 is 62% graphics.
- **t=2.5s:** band 1 at 62%; band 2 has begun sweeping (8%); band 3 is in its
  graphics hold showing the complete figure.
- **t=5s:** band 1 in its graphics hold; band 2 at 41%; band 3 sweeping back,
  restoring ASCII from the right (24% restored).

## 5. Reduced-motion freeze frame

**Cycle phases 4.10 s / 9.70 s / 15.30 s** for bands 1 / 2 / 3 — front at 0.55
forward, front at 0.55 reversing, and a settled graphics hold.

Chosen because it is the only phase triple that puts a **forward sweep**, a
**reverse sweep** and a **settled figure** on screen at once, with both crossfade
fronts caught mid-substitution. Any phase where a band sits in a hold at either end
of the cycle shows only two of the three states, and t=0 for all three would show
three identical prose bands.

Byte-stable: front position is a pure function of an accumulated phase; freezing
assigns the three phases directly. No RNG anywhere in the component.

## 6. Hue → luminance, both themes

Round-13 shared contrast ladder (see `INDEX-ascii.md`):

| stop | C | light α | dark α |
|---|---|---|---|
| 1 | 1.35 | 0.144 | 0.134 |
| 2 | 1.80 | 0.267 | 0.221 |
| 3 | 2.60 | 0.407 | 0.324 |
| 4 | 4.00 | 0.551 | 0.450 |
| 5 | 7.00 | 0.715 | 0.633 |
| 6 | 16.0 | 0.955 | 0.973 |

Two stops. The 3-cell crossfade band lifts to stop 6 at its centre and tapers to
the base stop at its edges — the substitution moment is the brightest thing on
screen and it moves in **luminance only**. No `--ns-accent`, ever, on this
component's climactic moment.

**Light theme is the hard case, and the fix is asymmetric.** Box-drawing glyphs
under the graphics mapping are 1–2 px strokes. In light theme a 1 px `--foreground`
stroke at α 0.715 antialiases to roughly C=3.0 against white, so the figure reads
*weaker* than the prose it replaced and the intended "prose empties into structure"
read inverts into "prose fades away." Therefore:

- **light:** prose at C=7.0 (α 0.715), graphics-mapped glyphs one stop hotter at
  C=16.0 (α 0.955)
- **dark:** both at C=7.0 (α 0.633) — a thin light stroke on near-black already
  blooms and needs no lift

State the asymmetry in the component as a deliberate choice, not a tuning accident.

## 7. Font handling

- **Metric assumption:** GeistMono advance = `0.600 * fontSize` (±0.002), measured
  post `document.fonts.ready` via `ctx.measureText("MMMMMMMMMM").width / 10`. The
  authored 80-column buffer is laid out from the **measured** `cellW`, so the
  figure's junctions stay aligned to the prose's letters.
- **Glyph coverage is the real risk here, not advance width.** The graphics targets
  are U+2500–U+253C plus `▒` U+2592, `◆` U+25C6 and `·` U+00B7. GeistMono covers
  U+2500–U+257F. Verify at mount:
  `measureText("─").width > 0 && measureText("─").width === measureText("M").width`,
  and the same for `▒` and `◆`. If either of the last two measures 0 or at a
  different advance, **drop those two mappings and author the figure from
  U+2500–U+253C only** — never ship a possible tofu, and never ship a glyph whose
  advance differs from the cell, which would shear every row after it.
- **Fallback with a different advance:** Consolas at 0.550 → `cellW = 8.25`, 87
  columns available for an 80-column buffer, leaving a harmless 8-column margin.
  Centre the buffer in the available columns rather than left-anchoring it, so the
  margin splits evenly instead of leaving a lopsided gutter at card scale.
