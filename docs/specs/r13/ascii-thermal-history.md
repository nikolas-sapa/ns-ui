# ascii-thermal-history — print-head thermal history control

**Collection:** core · **Surface:** footer signature block (GAP-MAP open gap #1 —
footer, 1 shipped)

## 1. Surface + the real technique

**Surface replaced:** the **footer** — the wide band that ends the page, carrying
the colophon, the legal line and the small print. `core/footer-ascii-rule` is a
back-to-top scroll instrument with a sitemap attached, not a footer block, so the
actual footer job is open (GAP-MAP §4, named three times in this repo's docs;
`footing-course` was built and removed for answering the *category* instead of the
component).

The answer here is not an invented house style: the footer's small print prints
itself, continuously, on a thermal head — the receipt tail that a transaction ends
with. Sitemap columns and links sit above as ordinary DOM; the band is the last
120–160 px of the page.

**Real technique:** direct thermal printing, and specifically **thermal history
control**. A thermal head is a row of resistive dot elements; each is pulsed, heats
past the paper's activation temperature (~90 °C for standard receipt stock), then
cools with a time constant of roughly **10–30 ms**. Because a line prints every few
tens of milliseconds, an element that fired on the previous line has not fully
cooled, and firing it again at the same energy over-darkens it. Every thermal
printer controller therefore implements *history control*: the drive pulse is
**shortened** when the same element fired recently and **lengthened** after an idle
run. This is documented in every thermal print-head application note (Kyocera,
ROHM TPH series) as history / thermal compensation.

## 2. Nearest existing slug + why this is not a restyle

**Nearest:** `core/loader-ascii-diffuse-fill` (Floyd–Steinberg serpentine error
diffusion). Secondary adjacencies checked and cleared: `core/fax-line-slip` uses
thermal *paper* and a mechanical roller-slip fault, with no element model at all;
`core/file-upload-thermal` is buoyant convection, not printing.

It is not a restyle because the coupling is a different kind of quantity. Floyd–
Steinberg propagates **quantization error** sideways into not-yet-processed
neighbours within a single pass: stateless between frames, symmetric in the plane,
and a pure consequence of the quantizer. Here the coupling is a physical
per-element **temperature** that persists across lines, decays exponentially in
real time, is **column-local** (an element only affects itself), **strictly causal
top-to-bottom**, and **asymmetric** — a hot element over-darkens and can never
under-darken. Nothing in the registry carries per-column state that survives from
one row to the next.

## 3. Mechanic — numbers

- **Elements:** one per column. `cellH = 12px`, `cellW` measured (GeistMono 12px →
  7.20px). At 720px wide → **100 elements**.
- **Grid at 720x480:** row pitch 12px → **40 rows visible**, scrolling up one row
  per `LINE_MS`.
- **`LINE_MS = 62`** → 16.1 lines/s, the band of a slow 80 mm receipt printer.
- **Element state:** `T_i` in normalised units, `0` = ambient, `1` = activation.
  Per line:
  `T_i ← T_i * exp(-LINE_MS / TAU) + P_i * G`, with **`TAU = 22ms`**,
  **`G = 1.0`**. Per-line decay factor `exp(-62/22) = 0.0592` — 94% of the heat is
  gone by the next line, which is why the effect is a one-to-three-line memory
  rather than a wash.
- **History control (the visible mechanic):**
  `P_i = target_i * (1 - 0.55 * T_i_before)`. An element that fired hard last line
  gets a **shorter** pulse this line.
- **Printed darkness:** `D_i = clamp01((T_i_after - 0.18) / 0.72)` — activation
  threshold 0.18, saturation 0.90.
- **The control strip.** History control is **disabled for the leftmost 3 columns**.
  Those three columns show what uncompensated thermal history actually does: a
  vertical run blooms into a solid smear within 2 lines, then over-recovers into a
  pale ghost for 2–3 lines after the run ends. The compensated 97 columns beside
  them hold a clean edge. That side-by-side contrast is the whole point and is
  visible with zero input.
- **Target field:** placeholder status text rendered through a 5x7 mask into the
  target duty, plus a 1-D noise floor at amplitude **0.12** (a hash of the line
  index, never `Math.random`) so untargeted elements still tick.
- **Glyph ramp:** *there is none, deliberately.* Each element prints a filled rect
  of width `cellW` and height `cellH * (0.72 + 0.28 * D)`, centred in the cell —
  real thermal dots grow as they get hotter. Tone is 6 alpha stops plus a 28%
  height modulation. Stated explicitly so a builder does not reach for
  `" .:-=+*#%@"`.
- **Fill ratio:** 21% of cells above `D = 0.05` at rest; 79% bare paper.

## 4. t=0s / 2.5s / 5s, no input

Seeded at line index 46.

- **t=0s:** the status text's first stroke is mid-band; the 3-column control strip
  is in a fresh bloom (two adjacent lines fully smeared together).
- **t=2.5s:** 40 lines later, the band has scrolled a full screen height; the bloom
  has walked off the top and the control strip sits in its pale over-recovery
  ghost while the compensated columns beside it are at full weight.
- **t=5s:** a new dense run has entered the strip and it is blooming again. Three
  visibly different states, all from an unconditional rAF loop.

## 5. Reduced-motion freeze frame

**Line index 46.** The whole line sequence is a pure function of the line index
(the noise floor is `hash(lineIndex)`, not `performance.now()`), so the frozen
frame is byte-stable indefinitely and reproducible from a cold mount.

Chosen because line 46 is the one index where the control strip's **bloom**, the
compensated columns' **clean edge**, and the **over-recovery ghost** left by the
previous run are all simultaneously on screen. Line 0 has zero thermal history by
definition — it is the single frame in which the entire mechanic is provably
absent, which is exactly why t=0 is wrong here.

## 6. Hue → luminance, both themes

Round-13 shared contrast ladder (full derivation in `INDEX-ascii.md`). Six stops
at target contrast against the page:

| stop | C | light α | dark α |
|---|---|---|---|
| 1 | 1.35 | 0.144 | 0.134 |
| 2 | 1.80 | 0.267 | 0.221 |
| 3 | 2.60 | 0.407 | 0.324 |
| 4 | 4.00 | 0.551 | 0.450 |
| 5 | 7.00 | 0.715 | 0.633 |
| 6 | 16.0 | 0.955 | 0.973 |

Thermal paper is white stock with a dark mark, so **light theme is the literal
reference rendering and dark theme is the inversion.** Do not invert by swapping
tokens: ink stays `--foreground`, paper stays `--background`, and the alpha stops
are re-solved from the dark column.

Measured mapping: an uncompensated **bloom** cell sits at stop 5 (light 0.715 /
dark 0.633); the **over-recovery ghost** sits at stop 1 (light 0.144 / dark 0.134).
If a builder reuses the light alphas in dark theme the ghost lands at C≈2.1 instead
of C=1.35 and the bottom half of the history mechanic disappears — the bloom/ghost
swing is the component. No `--ns-accent` anywhere; no `--border` as fill or stroke.

## 7. Font handling

- **Metric assumption:** GeistMono advance = `0.600 * fontSize` (±0.002). Measure
  post `document.fonts.ready` with `ctx.measureText("MMMMMMMMMM").width / 10`;
  re-measure on `ResizeObserver`.
- Nothing on the hot path renders a glyph — the band is rects only — so tone is
  immune to advance-width drift. `cellW` still matters because the **element count**
  and the 5x7 target mask are laid out in character cells and must align to the
  element columns.
- **Fallback:** Consolas at 0.550 → `cellW = 6.60`, **109 elements**, mask 9% wider
  in cells. `TAU`, `LINE_MS` and the 0.55 compensation coefficient are per-element
  and unit-free, so nothing else changes.
- **Guard:** assert `cellW >= 4px`. Below that the 3-column control strip is under
  12px wide and stops reading as a strip — widen it to 5 columns at that point, and
  state the switch in a comment so it is not mistaken for a magic number.
