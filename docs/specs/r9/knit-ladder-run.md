# knit-ladder-run

- **slug:** knit-ladder-run
- **tier:** core (card-scale canvas)

## Product surface it replaces
An ambient status/health feedback moment — a card background that reads as "structurally sound,
with occasional self-corrected faults," an alternative to a static success/health badge.

## The real mechanic
Weft knitting: each stitch is a loop of yarn drawn through the loop below it by a latch needle
(the needle's hook catches new yarn, the latch closes over the hook, and the old loop slides off
over the closed latch to complete the stitch), building fabric course by course. If a loop breaks
or is dropped, it fails to re-catch and the column of loops above it unravels sequentially
downward under tension — a "ladder" or "run" (the same fault that runs in a stocking). Repair uses
a real technique, latch-hook stitch pickup: a latch hook is threaded down through the ladder from
the top, catches the lowest loose loop, and draws it back up through each rung in sequence,
re-forming the column one stitch at a time. Source: weft-knit loop formation and latch-hook ladder
repair (textile/knitting).

**Differentiation from shipped siblings:** `text-stitch-unpick` is pointer-driven, letter-by-letter,
and irreversible per letter (a seam ripper picking apart a headline on hover). `optimistic-stitch`
encodes a single row's write lifecycle (pending/committed/rolled back) with a basting stitch, never
loops or repeats. This component is fully ambient/autoplay, builds a knit fabric continuously
course by course, and its ladder-run event is a recurring, self-healing fault — not a one-shot
lifecycle or a pointer interaction.

## One-sentence mechanic description
A field of knit stitches builds downward course by course, and at random intervals a dropped
stitch opens a ladder that runs down a few rows before a latch-hook repair catches it and reknits
the column.

## Rendering approach
2D canvas, `w-full h-full`. Stitch grid derived from the container's smaller dimension: ~10px
stitch pitch, columns = width/pitch (min 14, max 28), each stitch drawn as a small interlocked
loop glyph (two overlapping arcs).

## Real numbers
- Course (row) build rate: one full course completes every 900ms (real knitting-machine needle
  cycles run at high frequency — decoupled per the round 9 rule to one legible row-completion
  event rather than animating individual needle catches 1:1).
- Ladder-run trigger: roughly once every 7-10s, at a random column not currently running, a stitch
  drops.
- Ladder propagation: the gap runs downward one row every 350ms (visibly opening — the loop glyph
  at that cell collapses to a bare vertical gap over ~120ms of that window, not a blink) for 4-7
  rows before repair begins.
- Repair: a latch-hook glyph enters from below the gap and re-closes one rung every 300ms, working
  upward until the column matches its neighbors again; repair always completes (the fault never
  reaches the top edge unrepaired).
- At most one ladder active at a time.

## The resting loop
- t0: fabric mid-build, several complete courses, no active ladder.
- t=2.5s: 2-3 more courses added; possibly a ladder mid-run or mid-repair depending on the random
  trigger.
- t=5s: fabric has grown further (older courses scroll upward off the top edge as new ones build
  at the bottom, same unbounded-feed approach as a knitting machine's continuous fabric take-down),
  ladder state has visibly progressed or resolved from t=2.5s.

## Reduced-motion freeze frame
**ROW_SETTLED** — freeze on a frame with a small ladder gap frozen mid-run (2-3 rows open, not yet
repaired) sitting among otherwise-complete courses — the single frame that best shows both the
normal knit structure and the fault mechanic without any motion.

## Legibility
The ONE thing to follow: the ladder gap itself — where it is, and whether it's opening or being
closed. Propagation and repair both move at one row per 300-350ms, roughly a beat per row, slow
enough to track column position and direction (up vs. down) without needing to watch every stitch
in the field.

## Interaction
None. Fully ambient/autoplay; no pointer response (a hover-driven "picking" gesture would collide
with `text-stitch-unpick`'s established grammar).

## Light vs dark theme
Normal stitches: `--foreground` loop glyphs at moderate opacity, `--ns-muted` for the fabric
courses further from the current build edge (recedes slightly with "age," value only, no hue).
Ladder gap: rendered by simply omitting the loop glyph (background shows through) plus a single
`--foreground` vertical hairline marking the run's rails, so it reads as absence, not a colored
alert. Repair glyph: `--foreground`, same weight as normal stitches — never `--ns-accent`.

## Kill criteria
- If the ladder event reads as a broken render / bug rather than an intentional recurring fault,
  kill it.
- If courses build faster than ~700ms/row and the eye can't track the ladder's row-by-row
  propagation, slow it down or kill it.
- If it can't be visually distinguished from `text-stitch-unpick` or `optimistic-stitch` at a
  glance, kill it.
