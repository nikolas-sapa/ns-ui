# barograph-drum-week

- **slug:** barograph-drum-week
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces
Card — an ambient "this has been running continuously, unattended, for a
long time" status widget, the same family as `text-ekg-baseline` or
`stat-row-baseline-spark`, for a dashboard/status card that wants a slower,
more institutional feel than a live sparkline.

## The real mechanic
The aneroid barograph/thermograph: a clockwork motor turns a drum exactly
once per WEEK, wrapped in pre-printed chart paper ruled with day and hour
gridlines. A pen arm, driven by a stack of aneroid capsules (or a bimetallic
strip for a thermograph), inscribes a continuous trace as the drum creeps
around beneath it — the instrument's defining trait is that the paper itself
already carries the time grid, printed in advance, and the pen only ever
adds ink, never the ruling.

## One-sentence mechanic description
A pen arm inches rightward across a pre-ruled seven-day chart, its ink
trail lengthening continuously while faint day-gridlines pass beneath it.

## Rendering approach
DOM + canvas hybrid, card-scale, geometry from the container's smaller
dimension. Canvas holds two layers: a static-per-frame gridline layer
(7 vertical day divisions, each subdivided into 24 faint hour ticks, drawn
with `--border`) and an ink layer that only ever appends pixels, never
erases, matching the "permanent trace" identity shared with the recording-
instrument family. The pen arm itself is a DOM element (a short pivoting
line), positioned by trigonometry each frame so it stays crisp at any zoom
while the ink trail stays raster.

## Real numbers
- Real drum period: 7 days = 604,800s. This build compresses to a **45s**
  loop (documented ratio: 1 app-second ≈ 3.7 real hours) — the loop then
  crossfades back to day 0 over 500ms rather than hard-cutting.
- Trace generator: smooth low-frequency noise, one "weather front" swing
  roughly every **8-14s** (randomized), amplitude ±30% of chart height,
  layered with a fast micro-jitter of ±0.3px (capsule response noise) every
  frame.
- Day-gridline crossings: 7 across the 45s loop ≈ one every **6.4s** —
  gives the trace a periodic visual beat independent of the noise swings.
- Pen speed: chart width ÷ 45s, e.g. **6.7px/s** for a 300px-wide card —
  slow and steady, well clear of any aliasing concern.

## The resting loop
- **t0:** chart empty except gridlines, pen at day-0 left edge.
- **t=2.5s:** trace extends roughly 1/3 of a day-column, at least one
  micro-jitter wiggle visible.
- **t=5s:** trace crosses into day 1's gridline, visibly further and past
  at least one gridline crossing compared to t=2.5s.

## The reduced-motion freeze frame
Frozen at day 4 of 7 (~55% across), pen resting at the ink trail's leading
edge, at least one full weather-front swing already visible in the trace
behind it — a structured mid-week frame. Named `STATIC_DAY = 4`.

## Interaction
None required. If hoverable, a hover over a point on the trace may reveal
a DOM tooltip with a synthetic day/value readout — `--ns-accent` permitted
only on that tooltip/focus chrome, never mixed into the ink or gridlines.

## Light theme vs dark
Gridlines use `--border` at its designed near-invisible separator role in
both themes — they must read as a structural ruling, not a visible stroke.
Ink trail is `--foreground` at full value in both themes. Check light theme
first: this is the exact "`--border` as a fill/stroke" trap the token rules
call out, since a barograph's grid is dense (7×24 = 168 ticks) and easy to
accidentally over-darken into a visible mesh.

## Kill criteria
- If the compressed 45s loop reads as indistinguishable from a generic
  sparkline once the gridline paper and DOM pen arm are removed mentally —
  the physical pen-arm-on-pre-ruled-paper identity must be what's carried;
  if reviewers can't tell it apart from `chart-line-dither` or
  `sparkline-automaton` at a glance, kill it.
- If the 168-tick gridline mesh becomes visible as a solid wash rather than
  a faint ruling in either theme, reject until the token/opacity is fixed.
- If the pen-arm DOM overlay drifts from the canvas ink's actual endpoint
  (a sync bug between the DOM trig calc and the canvas draw), that is a
  disqualifying visual bug, not a shippable rough edge.

## Legibility
The one thing to follow: **the ink trail's leading edge lengthening under
the pen tip, with a day-gridline crossing every 6.4s** giving a steady,
countable beat to what would otherwise be a smooth, hard-to-track drift.
