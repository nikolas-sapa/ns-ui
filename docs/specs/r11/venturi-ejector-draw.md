# venturi-ejector-draw

- **tier:** core
- **product surface:** processing/"analyzing" loading spinner (replaces a
  generic spinner ring on an async task card).

## the real mechanic

An industrial Venturi vacuum ejector (compressed-air-powered vacuum
generator, used wherever a plant needs vacuum without a mechanical pump):
motive air is forced through a converging-diverging nozzle. At the
throat — the narrowest point — the flow speeds up sharply and static
pressure drops (Bernoulli/Venturi effect), and that low pressure entrains
a second stream drawn in from a side port, which joins the main flow and
gets flung out the diffuser.

## mechanic description

A jet stream necks through a narrowed throat and speeds up, and the low
pressure it creates there visibly pulls a second stream of particles in
and flings them out the diffuser.

## rendering approach

2D canvas, card-scale. Particle field width = container's smaller
dimension; particle cell size ≈ min-dimension / 40. Static foreground-
token outline traces the nozzle silhouette (converging cone → throat →
diverging diffuser, throat width = 22% of inlet width). Particles are
small dots with a short fading trail (3-4 historical positions at
descending alpha) standing in for motion streaks — no shader needed.

## real numbers

- Motive-stream emission: 14 particles/s at the inlet.
- Particle speed profile along the nozzle centreline: 40px/s at inlet →
  260px/s at throat centre → 90px/s at diffuser exit, area-ratio-derived
  smooth interpolation (not linear — speed rises steeply only in the last
  third of the converging cone).
- Entrainment side-stream: 6 particles/s drawn in from a side inlet,
  visible merging into the main stream just before the throat.
- ONE marked tracer particle every 2.4s, rendered at full `--foreground`
  opacity against the ambient stream's 55% — its throat transit is
  deliberately held to ~1.0s. A real ejector's throat transit is on the
  order of 15-40ms; this is a ~30x decouple from the real rate specifically
  so the acceleration reads as a followable event instead of a strobe (r9
  rule).
- Marked-tracer cycle repeats every 2.4s, clear of the "~1s between
  discrete events" floor.

## the resting loop

- t0: ambient particles distributed across the whole nozzle at varying
  local density/speed; a marked tracer at some arbitrary point in its
  cycle.
- 2.5s: the marked tracer has completed roughly one full transit (new one
  visibly at or near the inlet again), ambient particle positions have
  shifted continuously throughout.
- 5s: a second marked-tracer cycle is mid-transit at a different point than
  the 2.5s sample (2.4s period isn't commensurate with the 2.5s sample
  interval).

## reduced-motion freeze frame

THROAT_TRANSIT: the marked tracer sits exactly at throat centre — the
frame of maximum density/speed contrast between the constriction and the
open cone sections, the most structured single frame in the cycle. Not
t0's arbitrary distributed state.

## interaction

None required — ambient loader only. If a text label ("processing…")
overlays it, that's plain text, not motion-bearing. The marked tracer must
stay distinguished by luminance alone (full `--foreground` vs. 55%
ambient) — never accent-tinted.

## light vs dark theme

Nozzle outline drawn in `--ns-muted` (structure must survive at low
contrast in light theme — `--border` alone is too faint for a shape this
central to the mechanic) with the constriction unmistakably narrower than
the cone ends. Particles are always `--foreground` with alpha modulation
only, identical logic in both themes.

## legibility

The ONE thing to follow: the single marked tracer visibly speeding up as
the nozzle narrows around it. Cadence: one marked-tracer cycle every 2.4s,
each throat transit rendered at ~1.0s — both comfortably past the
"~1s between discrete events" floor despite the real mechanic being
millisecond-fast.

## kill criteria

- If the throat's speed-up isn't perceptible against the ambient particle
  field at card scale (i.e. the nozzle just looks like a pipe with dots
  drifting through it), reject — the constriction has to visibly do
  something to the flow.
- If the marked tracer can't be told apart from ambient particles without
  staring, the luminance-only distinction has failed; reject rather than
  reach for accent.
