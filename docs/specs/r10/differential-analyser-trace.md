# differential-analyser-trace

**tier:** core

**product surface it replaces:** a live/streaming line-chart background — the ambient
sparkline-style visual that sits behind or beside a metric card, in the same family as
`sparkline-automaton` and `chart-line-dither` but a distinct rendering mechanic, not a
restyle of either.

**the real mechanic, with source:** the wheel-and-disc integrator unit of a mechanical
differential analyser (Bush-type, 1930s analog computer). A rotating disc turns at a
steady rate; a small friction wheel rests on the disc's face at a radius controlled by an
input variable, and the wheel's own rotation rate is proportional to (disc angular
velocity x radius) — i.e. the wheel continuously integrates the input over time. As the
input value changes, the wheel is pushed toward or away from the disc's center, changing
how fast it spins, and the wheel's cumulative rotation traces the running integral onto an
output shaft. Sourced from the integrator unit specifically, not the analyser's full
gear-train assembly.

**one-sentence mechanic description:** a small wheel rides at a wandering radius across a
steadily spinning disc, and the trail it leaves behind is the running total of wherever it
has been.

**rendering approach:** 2D canvas. Disc drawn as a circle sized to the container's smaller
dimension x 0.8; the wheel's radius-on-disc is driven by a slow pseudo-input signal (sum of
two incommensurate sine waves so it never exactly repeats); a second, adjacent trace panel
(width = container width - disc diameter) plots the wheel's cumulative rotation as the
output curve, scrolling left as it draws, same technique family as `histogram-live-grain`'s
live scroll but a different signal shape.

**REAL NUMBERS:**
- disc rotation rate: **0.5 rev/s** (720°/s), constant, never stops.
- input signal (wheel radius as fraction of disc radius): `0.5 + 0.35*sin(t/4.7) +
  0.15*sin(t/1.3)`, recomputed every frame, radius fraction clamped to [0.05, 0.95].
- output trace sample rate: **20 samples/s** (one new point every 50ms), independent of
  disc rotation rate — this decouples the visual trace cadence from the fast 0.5 rev/s
  disc spin so the trace itself never looks like it's chasing the disc.
- trace panel scroll speed: **24px/s** leftward, panel holds **12s of history** before the
  oldest samples fall off the left edge.
- wheel visual rotation on the disc face: rendered at the real 0.5 rev/s x radius-fraction,
  capped visually at 3 rev/s max apparent spin so an extreme radius excursion never blurs
  into a strobe (rate-decoupling per the round-9 filter: the *disc* is the fast, real-rate
  element and stays legible because it's a single smooth continuous rotation, not a
  discrete flicker).

**the resting loop — t0 / 2.5s / 5s:** t0: wheel sits at some radius on the disc, trace
panel shows the last 12s of curve ending at the current instant. t=2.5s: disc has completed
1.25 more revolutions, wheel has visibly migrated to a different radius, trace panel has
scrolled ~60px left with new curve segment drawn at the right edge. t=5s: wheel radius has
crossed back through at least one full swing of the input signal (a shift toward center and
back out), trace shows a visibly different curve shape than at t0, not just a shifted copy
of the same shape.

**reduced-motion freeze frame:** `STATIC_PHASE = 3.14` (t in seconds since a fixed epoch) —
freezes on a frame where the wheel sits at roughly 60% radius (visibly off-center, not
parked at the rim or the hub) and the trace panel shows a curve with both a rising and a
falling segment in view, the most structured single frame the loop produces.

**interaction:** none required for the core mechanic. Optional: hovering the trace panel
may show a thin luminance-only guideline at the pointer's x-position (no accent tint, no
value tooltip — a tooltip would pull this toward a data-viz/analytics-tool surface, which
is out of scope). Must NOT gain draggable controls, axis labels, or numeric readouts —
those would tip it into the "dashboard" auto-reject.

**light vs dark theme:** disc fill from `--background`, disc rim and wheel from
`--foreground` at full and 70% opacity respectively; trace line at `--foreground` 85%
opacity, trace panel fill a 4%-opacity `--foreground` wash so old area doesn't read as
literal chart "fill." `--border` used only for the 1px divider between disc and trace
panel. Light theme check: the wheel-on-disc contact point must stay visible at ~1.3:1-2:1
contrast against the disc fill in light mode — verify the wheel isn't washed out against a
near-white disc before shipping.

**legibility line:** the ONE followable thing is the wheel's radius on the disc drifting
inward and outward over roughly a 10-15s cycle (from the two summed sine periods), visibly
correlated with the trace curve's rise and fall in the adjacent panel — cadence: the radius
swing is slow enough (multi-second) to track by eye continuously, and the trace panel gives
a second, delayed confirmation of the same motion a few seconds later.

**kill criteria:** if the wheel-on-disc radius change reads as arbitrary wobble with no
visible causal link to the trace curve beside it, or if the fast constant disc spin
dominates the eye and drowns out the slow radius signal that's the actual point, kill it.
