# ascii-chain-slew — a page that prints in alphabetical order

**Collection:** core · **Surface:** logo wall / trust wall

## 1. Surface + the real technique

**Surface replaced:** the logo wall — the band of partner or client marks.

**Real technique:** the **IBM 1403 chain printer** and its band-printer descendants.
The type is carried on a continuous horizontal chain revolving at constant speed
past 132 stationary hammers; a hammer fires the instant the character it needs
passes it. The consequence is the machine's defining property: **a line does not
print left to right.** Every `A` on the line prints simultaneously, then every `B`,
and so on, in chain order. The 1403's known artifact set follows directly —
identity-ordered assembly, and vertical registration wobble when hammer timing
drifts against chain speed (the "wavy line" fault).

## 2. Nearest existing slug + why this is not a restyle

**Nearest shipped:** `core/ticker-teleprinter` — a fixed row of monospace cells that
advances one cell per beat by content substitution. **Nearest in-round:**
`docs/specs/r13/convert-matrix-return.md`, the Linotype distributor logo wall.

Against `ticker-teleprinter`: that advances a tape one cell per beat — a
**positional**, left-to-right, per-cell mechanic. Here position is fixed and
**identity is the ordering key**: the frame's state is "the chain is at glyph index
`k`, so every cell whose target character has chain index ≤ `k` is printed and the
rest is bare paper." Two cells 400 px apart appear in the **same frame** because
they share a letter. A positional crawl can never do that.

Against `convert-matrix-return`: both use glyph identity to order a mechanical
process, so the discriminator has to be stated once and held. **The test is whether
the viewer sees objects travelling.** matrix-return: yes — marks ride a distributor
rail at 74 px/s and fall into channels; the travel is the image. This component:
**no.** The chain is entirely off-screen and there is **zero translation anywhere in
the component**. Nothing slides, nothing rides, nothing falls. Glyphs appear in
place, simultaneously, across the whole grid. That is a deliberate constraint of
this spec, not an incidental one — if a builder finds themselves drawing the chain
to make the mechanic legible, this component has become matrix-return and should be
killed rather than shipped.

## 3. Mechanic — numbers

- **Chain content:** a 47-position arrangement in the spirit of the 1403 "PN" chain:
  `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-/&$*%#@` plus space.
- **Chain speed:** **26 ms per glyph position** → one revolution = 47 x 26 =
  **1222 ms**.
- **Cell:** `cellH = 14px`, `cellW` measured (GeistMono 14px → 8.40px). At 720x480 →
  **85 cols x 34 rows**.
- **Layout:** 12 placeholder wordmarks (`PARTNER ONE` … ) in a 4 x 3 arrangement,
  each occupying a 20 x 8 cell block with a 1-cell gutter. Wordmarks are real
  monospace characters, one per cell — **not** a 5x7 bitmap mask. Placeholder text
  only; the component ships no third-party marks.
- **Printing:** at chain position `k` (0..46), every cell whose target character
  equals `CHAIN[k]` is stamped.
- **Registration wobble:** each printed cell carries a vertical offset
  `dy = A * sin(2*pi * (row * 0.37 + impression * 0.11))`, with `A` fixed **per
  impression** (not animated) and stepping 0 → 1.9 px across successive
  impressions. Deterministic, no RNG. 1.9 px is registration error, not travel —
  nothing moves after it is placed.
- **Cycle:** one revolution prints the wall (1222 ms), then a **700 ms hold** at
  full impression, then the whole grid **clears at once** — the paper advance is
  instantaneous and off-screen, precisely so nothing translates — and the next
  impression begins with the next wobble phase. Cycle **1922 ms**, unbounded, no
  input.
- **Fill ratio:** wordmark cells are 31% of the 85 x 34 grid; the other 69% never
  prints. Because English letter frequency front-loads the chain, ~46% of wordmark
  cells are down by `k = 12`. Whole-grid ink at a typical mid-revolution frame:
  **~14%**.
- **Ink, two states plus a transient:** a chain printer is one impact, one weight.
  Every printed cell sits at C=7.0. The just-struck glyph flashes at C=16.0 for
  **90 ms**, then settles. Two states and a decay — the same discipline as
  `divider-petscii-vu`'s strict two-state cell, with one transient added so the
  identity ordering is readable.

## 4. t=0s / 2.5s / 5s, no input

Seeded at revolution phase 340 ms (`k = 13`). Each impression restarts from bare
paper, so the three samples land in genuinely different chain positions:

- **t=0s (`k = 13`):** vowels plus R and T are down — the wall reads as a lace of
  partial words with a third of each name missing.
- **t=2.5s (impression 2, `k = 6`):** only A–G are down. Sparser than t=0 and
  structurally different — different letters, different holes.
- **t=5s (impression 3, `k = 12`), 90 ms into the hold-to-clear boundary:** the wall
  is near-complete with a fresh wobble phase, so every row's baseline sits at a
  different offset than it did at t=0.

## 5. Reduced-motion freeze frame

**Chain position `k = 17` of impression 1, wobble amplitude 0.9 px.**

`k = 17` (through `R`) is where the printed set first crosses **60%** of the
wordmark cells — the wall is readable as words while a third of the letters are
still missing, which is the only state that actually *shows* identity ordering.
`k = 46` is a fully printed wall indistinguishable from static text; `k = 0` is bare
paper. The 0.9 px wobble is mid-range, so the registration fault is visible without
looking like a layout bug.

Byte-stable: chain position, the printed set and the wobble are all pure functions
of `(impression, k)`; freezing assigns both directly. No RNG, no `performance.now()`
in the state.

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

Two ink states only, so the mapping is two stops: settled at C=7.0 (light α 0.715 /
dark α 0.633), the 90 ms strike flash at C=16.0 (light α 0.955 / dark α 0.973).

**Light theme is the hard case for the flash.** Against white paper the specified
pair is α 0.955 → α 0.715, i.e. **C=16.0 → C=7.0** — a 2.3x contrast step, which
reads clearly as an event. The naive alternative a builder will reach for (flash at
α 1.0, settle at α 0.85) gives 17.9 → 11.4, a 1.6x step the eye barely resolves on
white, and the identity ordering stops being legible as an *event*. Note the light
ceiling is 17.93:1 at α 1.0, so stop 6 is realizable with headroom to spare; do not
push the flash to α 1.0 chasing contrast that is not there. In dark theme the same pair of stops works
unchanged because ink adds on near-black. State both numbers.

The strike flash is `--foreground` luminance only. `--ns-accent` must not touch it —
this is the component's climactic moment and therefore exactly where the project's
most-repeated defect would land.

## 7. Font handling

- **Metric assumption:** GeistMono advance = `0.600 * fontSize` (±0.002), measured
  post `document.fonts.ready` via `ctx.measureText("MMMMMMMMMM").width / 10`, and
  re-measured on `ResizeObserver`. Glyphs are drawn centred per cell
  (`textAlign: "center"`, `x = col * cellW + cellW / 2`).
- **Fallback with a different advance:** Consolas at 0.550 → `cellW = 7.70`,
  **93 columns** instead of 85. The 4 x 3 block layout must be **derived from the
  measured column count**, never hardcoded, or the right-hand column of wordmarks
  clips at the card edge. The vertical wobble is in px and is unaffected.
- **Missing chain glyphs:** `& $ * % # @ . , - /` are present in every mainstream
  monospace fallback, but verify rather than assume. If
  `ctx.measureText(ch).width === 0`, or the width differs from `measureText("M")` by
  more than 0.5 px, drop that position from the chain and shorten the revolution
  accordingly — print nothing rather than tofu, and recompute the 1222 ms revolution
  from the surviving chain length so the cadence stays honest.
