---
name: mono_glyph_family_baseline_mismatch
desc: Box-drawing glyphs render centred in the em box while block-fraction glyphs sit flush to the baseline — the two families cannot be aligned in one monospace character grid by row arithmetic, no matter how correct the row index is.
created: 2026-07-30T08:40:00Z
updated: 2026-07-30T08:40:00Z
---

# mono_glyph_family_baseline_mismatch

A character-grid component that mixes **block-fraction glyphs**
(`▁▂▃▄▅▆▇█`, U+2581-2588) with **box-drawing glyphs** (`╱ ╲ ─ │ ┌ ┐`,
U+2500 block) will render the two families at different vertical positions
*within the same grid row*. This is a font-metric property, not a layout
bug, and it cannot be corrected by fixing the row index.

- Block-fraction glyphs are designed to tile a filled cell. They sit flush
  to the cell's baseline and grow upward, which is what makes them usable
  as bar-chart fills.
- Box-drawing glyphs are designed to connect to their neighbours. They are
  centred in the em box so a `─` meets the `─` beside it at mid-height.

Put a `╱` and a `█` in the same row and the `╱` floats above the `█`.

## How this presented

`sparkline-ascii` drew bars from block-fraction glyphs and a trend line from
`╱ ╲ ─`. The trend line rendered visibly detached, floating above the bar
tops, reading as a rendering fault rather than a chart.

The first cause found was real but insufficient: the line's row index was
computed as `round(norm * (ROWS - 1))` while the bar heights used
`floor(norm * ROWS * 8) / 8`, so different rounding put the line a row off.
Fixing that to derive both from the same fullRows/remainder arithmetic was
verified correct by substituting `█` for the trend glyph, which then sat
flush on the bar top with no gap.

With the real `╱ ╲ ─` glyphs restored, the float came straight back. Same
row, same arithmetic, different family, different vertical position.

## What to do

**Do not** try to correct it with a per-glyph CSS nudge (`translateY`, a
tweaked `line-height`, a negative margin). The offset depends on the font's
metrics, so a value tuned against GeistMono breaks under any fallback font,
and the fallback is what renders before `document.fonts.ready`.

Pick one:

1. **Use one family for anything that must align.** Draw the line out of
   block glyphs too, or draw the bars out of box-drawing glyphs. Alignment
   is then free.
2. **Drop the overlay.** This is what `sparkline-ascii` did. A clean bar chart
   reads better than a bar chart with a detached line through it, and the
   removal also took an orphan glyph on the last column with it.
3. **Render to canvas instead of a DOM text grid** if both families are
   genuinely required, since `fillText` lets you place each glyph at an
   explicit y and measure it with `measureText` rather than inheriting
   line-box behaviour.

## Related

The same "measure, do not assume" principle applies to cell width: measure
the mono advance with `measureText` on an offscreen canvas gated on
`document.fonts.ready`, never at mount, or a fallback-font measurement
bakes in the wrong ratio until reload. See the loud ASCII components
(`ascii-torus-donut`, `ascii-globe-spin`, `background-ascii-plasma`) for that pattern.
