# tufting-gun-loop-pile

- **slug:** tufting-gun-loop-pile
- **tier:** core (card-scale canvas)

## Product surface it replaces
An empty-state / background texture fill — an alternative to `empty-state-pegboard` or
`empty-state-dashed` for a card that wants ambient, self-building texture rather than a static
illustration.

## The real mechanic
A tufting gun plunges a hollow needle straight down through a backing cloth stretched on a frame,
grips the yarn, and withdraws, leaving a loop of pile standing on the front face; the gun then
advances a fixed pitch and repeats, building a dense pile field row by row across the backing (the
process used to make tufted rugs and carpet). Source: hand/machine tufting gun operation
(textile/carpet manufacture).

**Differentiation from shipped siblings:** `peen-coverage` is a *stochastic* process — uniform-random
impacts saturating a field, no ordered rows, no swept head. This is the opposite: an ordered,
carriage-swept, row-by-row grid fill, and the pile itself is a height/texture field (loops), not a
flat coverage percentage. `screen-flood-stroke` sweeps one continuous blade stroke across the whole
field per cycle; this plunges discrete, individually-timed loops at grid cells.

## One-sentence mechanic description
A gun head sweeps row by row across a backing grid, plunging a loop of pile at each cell just
behind it, and the finished field continuously scrolls off one edge as new rows tuft in on the
other so the carpet never stops building.

## Rendering approach
2D canvas, `w-full h-full`. Pile field grid derived from the container's smaller dimension: cell
pitch ~9px, so a 240px-tall card gets ~26 rows; width follows the same pitch, field is wider than
the visible card and scrolls. Each tuft cell renders as a small filled loop (a short vertical
ellipse with a highlight edge) once plunged, empty backing weave (a faint crosshatch at
`--border`) before.

## Real numbers
- Real industrial tufting guns run 800-1500 punches/minute per needle — decoupled per the round 9
  rule: individual tuft "pop" (backing -> filled loop) takes 90ms, fast enough to read as an
  instant, discrete event but never simultaneous across a row.
- Row sweep rate: the gun head crosses one row (26-40 cells depending on width) in 1.1s, i.e.
  ~24-36 cells/second along the row — a legible sweep, not a strobe.
- Field feed: after a row completes, the whole tufted field scrolls up (perpendicular to sweep
  direction) by exactly one row-pitch (9px) over 260ms ease, so old rows exit the top edge as new
  rows tuft in at the bottom — unbounded, never restarts or resets.
- Gun head indicator: a small crosshair/carriage mark drawn at `--foreground`, always at the
  leading edge of the current row's filled cells.

## The resting loop
- t0: head mid-row, roughly a third of that row's cells filled, several completed rows visible
  above scrolling toward the top edge.
- t=2.5s: field has advanced ~2-3 rows further (scrolled up accordingly), head now partway through
  a different row.
- t=5s: field has advanced several more rows; the specific pattern of filled vs. empty cells at
  t0 has scrolled entirely off-frame.

## Reduced-motion freeze frame
**GUN_MIDROW** — freeze with the head paused mid-row (roughly 50% through the current row), a
handful of completed rows above it and empty backing weave below — the most structured single
frame (mixed filled/unfilled state, head visibly mid-sweep, not at a row boundary).

## Legibility
The ONE thing to follow: the gun head/crosshair sweeping along its row, with tufts popping in
just behind it. Sweep rate (~30 cells/s across a ~1.1s row) is fast enough to feel like active
work but slow enough that the eye can track the head's position at any instant; the per-tuft pop
(90ms) is a detail, not the thing being tracked.

## Interaction
None. Ambient background only — no pointer response, no autoplay parameter dependency (it must be
a genuine unconditional rAF loop per the "alive at rest" gate, not an autoplay-mode descriptor).

## Light vs dark theme
Filled loop pile: `--foreground` fill with a 1px lighter rim (derived by nudging the same token's
luminance up, never `--ns-accent`) to sell the loop's rounded top catching light. Empty backing
weave: faint `--border`-token crosshatch (correctly used as a separator, not a fill of solid
shapes). Gun head mark: `--foreground`, slightly larger stroke weight so it stays visible against
both filled and empty cells in both themes.

## Kill criteria
- If the row-by-row order isn't visually distinguishable from `peen-coverage`'s random scatter at
  a glance, kill it (the ordered sweep is the entire reason this exists).
- If the scrolling feed reads as jittery/unstable rather than a smooth, steady conveyor, kill it.
- If it reads as generic "loading tiles" rather than a legible loop-pile texture, kill it.
