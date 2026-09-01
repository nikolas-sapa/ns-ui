# ascii-double-height — mixed cell sizes in one glyph grid

**Collection:** core · **Surface:** testimonial / social-proof band (GAP-MAP open
gap — testimonial, 2 shipped)

## 1. Surface + the real technique

**Surface replaced:** the **testimonial band** — a wall of short placeholder quotes
with attribution lines. Only `testimonial-wall-reflow` and one sibling ship today.

The line-attribute mechanic maps onto this surface exactly: a quote wall is a text
buffer in which some lines want emphasis and others are supporting, and a VT100
expresses emphasis by *changing a line's cell size*, not its weight. Promotion also
truncates, which is the editorially honest failure a quote wall actually has.
All quote text is placeholder — no attributed claims, no figures.

**Real technique:** **DEC VT100 line attributes.** A VT100 line carries one of four
attributes, set by a control sequence:

- `ESC # 5` — DECSWL, single-width single-height (the default)
- `ESC # 6` — DECDWL, **double-width** single-height
- `ESC # 3` — DECDHL **top half**
- `ESC # 4` — DECDHL **bottom half**

Two consequences make this a mechanic rather than a font-size change. First, a
double-height line is **two screen lines carrying identical content** — line N draws
the top halves of the glyphs, line N+1 draws the bottom halves — and if the two
lines' contents differ the terminal renders the top of one string over the bottom of
another. That pairing invariant is a real, well-known class of VT100 bug. Second,
double width halves the columns available on that line (80 → 40) and the overflow is
**truncated at the right margin, never wrapped**.

## 2. Nearest existing slug + why this is not a restyle

**Nearest:** `loud/hero-recursive-type` (each lit coarse cell subdivided into an NxN
grid of fine cells) and `core/lens-ascii-magnify` (a lens redraws the text under it
as a finer 5x7 dot matrix).

Both of those hold **one cell size for the whole grid** and change what fills a
cell. Here the grid itself carries **mixed cell metrics simultaneously**: a 1x1
line, a 2x1 line and a 2x2 line-pair coexist in the same buffer at the same instant,
and each has a different column budget (75 / 37 / 37 at the geometry below). No
component in the registry has rows with different cell metrics. And the size change
is not decorative — it **changes what fits**, so promoting a line visibly amputates
its tail. That consequence cannot exist in a fixed-pitch grid.

## 3. Mechanic — numbers

- **Base cell:** `cellH = 16px`; `cellW` measured (GeistMono 16px → 9.60px).
- **Grid at 720x480:** 75 single-width columns x 30 rows.
- **Buffer:** 30 lines of placeholder copy, each carrying an attribute in
  `{SWL, DWL, DHL_TOP, DHL_BOT}`. `DHL_TOP` must be immediately followed by
  `DHL_BOT` with identical content — the pairing invariant is enforced by the
  buffer, and violating it deliberately is the fault below.
- **Rendering:** SWL at `cellW x cellH`; DWL at `2*cellW x cellH` (37 columns fit);
  DHL at `2*cellW x 2*cellH` drawn as two half-slices. **Draw the 2x glyph once and
  clip it twice** — `ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, cellH);
  ctx.clip();` with a y-origin of `y` for the top half and `y - cellH` for the
  bottom. Never two separate half-size draws (see §7).
- **Attribute churn — the resting loop.** Every **1150 ms** one line, chosen by the
  deterministic sequence `line = (step * 7 + 3) % 23`, steps through a fixed 6-step
  promote/demote cycle `SWL → DWL → DHL → DHL → DWL → SWL`. Promotion to DHL
  consumes the following line (its content is pushed down); demotion releases it, so
  **the whole buffer reflows on every step**. Sequence period 23 x 1150 ms =
  **26.45 s** — never repeats inside a screenshot window.
- **Truncation.** On promotion the line's column budget halves and the overflow is
  clipped at the right margin, no ellipsis, no wrap. On demotion it reappears. That
  appearing/disappearing tail is free, unforced motion.
- **Promotion ease.** Not a pop: over **260 ms** the line's cell scale eases 1.0 →
  2.0 on `ease-out-cubic`, glyphs draw at the intermediate scale, and the column
  budget is recomputed **every frame from the live scale**, so characters drop off
  the right edge one at a time during the ease.
- **Desync fault — the signature.** On every 7th promotion (`step % 7 === 3`,
  deterministic) the DHL pair is desynced for **620 ms**: the bottom line keeps the
  *previous* line's content, so the panel shows the top of one word over the bottom
  of another. It re-syncs with a **180 ms** snap.
- **Fill ratio:** placeholder copy runs ~62% non-space per line; because a DHL pair
  spends 2 rows on 1 line of content, panel ink coverage oscillates between **41%**
  and **33%** across the cycle.

## 4. t=0s / 2.5s / 5s, no input

Seeded at sequence step 9, phase 400 ms.

- **t=0s:** 2 DWL lines and 1 DHL pair; one line is mid-promotion with 3 characters
  dropping off the right edge.
- **t=2.5s (step 11):** the DHL pair has demoted and a different line has promoted,
  so the on-screen line count changed by one and everything below shifted up 16 px.
- **t=5s (step 13, phase 250 ms):** a desync fault is live — the bottom half of the
  DHL pair carries the previous line, showing tops and bottoms of different words.

## 5. Reduced-motion freeze frame

**Sequence step 17, phase 810 ms.** Step 17 is the only phase in the 23-step cycle
where all four attributes are on screen **and** a desync is live: 24 SWL lines, 2
DWL lines, one clean DHL pair, and one desynced DHL pair. Step 0 is a uniform SWL
buffer, indistinguishable from plain monospace text — the mechanic would be
invisible.

Byte-stable: the sequence is `(step * 7 + 3) % 23` over the line index with no RNG
and no `performance.now()` in the state; freezing sets `step` and `phase` directly.

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

Base assignment: body text at stop 5. The desynced pair's bottom half at stop 6 for
its 620 ms, so the fault is unmistakable with zero hue. The clipped-tail right
margin gets a 1-cell rule at stop 1 — **not `--border`**, which measures 1.19:1 in
light theme and would vanish exactly where the truncation has to read.

**Light theme is the hard case, and it is theme-asymmetric.** A 2x-scaled glyph
carries 4x the ink area of an SWL glyph. In light theme, ink subtracts from white,
so at a shared alpha a DHL line reads as a heavy black block and tips the panel's
value balance — measured, the naive shared ladder makes a light-theme DHL line
**2.3x** the apparent weight of its neighbours. Compensate per theme:

- **light:** SWL C=7.0 (α 0.715) · DWL C=4.0 (α 0.551) · DHL C=2.6 (α 0.407)
- **dark:** SWL C=7.0 (α 0.633) · DWL C=5.2 (α 0.545) · DHL C=4.0 (α 0.450)

The dark compensation is deliberately much smaller: a large ink area on near-black
does not bloom the way a large ink area on white crushes. State both ladders in the
component; do not share one. No `--ns-accent` anywhere.

## 7. Font handling

- **Metric assumption:** GeistMono advance = `0.600 * fontSize` (±0.002), measured
  post `document.fonts.ready` via `ctx.measureText("MMMMMMMMMM").width / 10` and
  re-measured on `ResizeObserver`. DWL/DHL multiply the **measured** `cellW`, never
  a constant.
- **Fallback with a different advance:** Consolas at 0.550 → `cellW = 8.80`, 81 SWL
  columns, 40 DWL columns. Because the column budget is recomputed from the
  measurement, truncation still lands on the correct character; only how many
  characters survive changes.
- **The real hazard is non-linear scaling.** A fallback that resolves to a hinted
  bitmap face does not render the 2x glyph as exactly twice the 1x glyph, so
  independently drawn DHL halves will not meet at the seam — a 1–2 px light or dark
  line through every double-height letter. This is why §3 mandates **one 2x draw,
  clipped twice**: the halves then join by construction, whatever the font does.
- **Guard:** if `measuredCellW / fontSize` falls outside `[0.45, 0.75]` the resolved
  face is not monospace; fall back to SWL-only rendering (all attribute churn
  disabled, buffer static) rather than shipping a misaligned grid.
