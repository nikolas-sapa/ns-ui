# warp-knit-tricot-lapping

- **slug:** warp-knit-tricot-lapping
- **tier:** core (card-scale canvas, ambient background/divider)

## Product surface it replaces
An ambient background/divider texture — an alternative to `background-truchet-weave` or
`divider-petscii-vu` for a strip or panel that wants a continuously-building diagonal pattern.

## The real mechanic
Warp knitting (tricot): unlike weft knitting, every needle has its own yarn fed from a guide bar
that holds all yarns in a row. Between each course, the guide bar shogs (shifts) sideways by one or
more needle spaces before swinging the yarns back to the needles, so each thread laps diagonally
across neighboring needles course after course instead of staying in one column — the diagonal
shog-and-lap is what makes tricot's diagonal wale structure and gives it run-resistance (unlike
weft knit, no single dropped stitch can ladder the whole column). Source: warp knitting / tricot
guide-bar lapping motion (textile/knitting, distinct machine family from weft knitting).

**Differentiation from shipped siblings:** `loader-loom-weave` is weft insertion on a shuttle
loom — a weft thread crossing the FULL width of a fixed warp, over/under. This is the opposite
motion: the whole guide bar shifts a SHORT lateral distance (1-3 needle spaces) between courses,
producing a diagonal zigzag lapping pattern, not a full-width shuttle pass. `knit-ladder-run` (this
same batch) is weft knitting and explicitly relies on the fact that a dropped loop CAN ladder; this
mechanic is knit but structurally can't ladder, and must not include a ladder-run event — keep the
two visually and behaviorally distinct.

## One-sentence mechanic description
A row of yarn guides builds diagonal zigzag laps course by course, each guide bar shift
alternating direction by a fixed number of needle spaces, continuously extending a wale structure
that a dropped stitch can never ladder.

## Rendering approach
2D canvas, `w-full h-full`. Needle columns derived from the container's smaller dimension: pitch
~11px. Each course renders as a set of short diagonal line segments (one per guide/needle),
connecting each needle's position in the previous course to its shogged position in the new
course; segments accumulate downward, building a continuous interlocking chevron/zigzag texture.

## Real numbers
- Course rate: one course completes every 500ms (warp-knit machines run courses at high
  frequency in reality — decoupled to a legible per-course build rather than 1:1).
- Guide bar shog: alternates 2 needle-spaces right, then 2 needle-spaces left, every course (a
  simple "2 and 2" tricot lapping pattern, the most basic real tricot chain notation), each shog
  animated as a 200ms eased lateral slide of the whole guide row before the lap segment is drawn.
- Field feed: same unbounded scrolling-field approach as the other specs in this set — completed
  courses scroll upward off the top edge as new ones build at the bottom, one course-height
  (~9px) per 500ms.

## The resting loop
- t0: mid-build, a zigzag chevron texture filling most of the field, guide bar mid-shog partway
  through a lateral slide.
- t=2.5s: field has advanced 5 courses, shog direction has reversed at least twice (visible
  chevron reversals in the accumulated texture).
- t=5s: field has advanced roughly 10 courses further; the specific chevron pattern visible at t0
  has scrolled off the top edge.

## Reduced-motion freeze frame
**LAP_SETTLED** — freeze immediately after a shog completes and its lap segments have been drawn
(not mid-slide), on a frame showing at least 2 full chevron reversals in the accumulated
texture — the most structured static frame.

## Legibility
The ONE thing to follow: the guide bar's lateral shog direction (left vs. right) at each course,
visible as the chevron's alternating diagonal. One shog every 500ms is fast enough to feel like
active, continuous machine work but each shog's 200ms slide gives a clear directional motion to
track rather than an instantaneous jump.

## Interaction
None. Ambient/autoplay only.

## Light vs dark theme
Lap segments: `--foreground` strokes, uniform weight, no fill (the chevron texture is entirely
linework). Guide bar (the row currently shogging): drawn as a thin `--foreground` horizontal
indicator above the active course, slightly higher-contrast than the settled lap texture below it
so the eye can find "where the work is happening" at a glance in both themes. No `--border` used
as a stroke on the lace/lap itself (reserved for any container/separator chrome only). No
`--ns-accent`.

## Kill criteria
- If the diagonal chevron pattern is visually indistinguishable from `background-truchet-weave` at
  a glance, kill it.
- If the guide-bar shog reads as a generic sideways scroll rather than a legible alternating
  zigzag, kill it.
- If it visually converges with `loader-loom-weave`'s full-width shuttle-pass look once built out,
  kill it (this must stay a short lateral shog, never a full-width crossing).
