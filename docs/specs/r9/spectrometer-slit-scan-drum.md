# spectrometer-slit-scan-drum

- **slug:** spectrometer-slit-scan-drum
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces
Card — an ambient "instrument actively measuring, mechanically geared, not
just animating" status widget, adjacent to `dial-moire`/`tacho-disc` but
distinguished by a recording pen rather than a live-only dial.

## The real mechanic
A recording spectrophotometer: a motor slowly rotates a diffraction grating
(or prism), sweeping which wavelength passes an exit slit onto a detector.
The recorder's pen and the paper feed are BOTH mechanically geared to that
same motor shaft — not to a clock — so the horizontal axis of the trace is
wavelength, not time: if the grating's rotation stalls, the pen and the
paper stall with it, in lockstep, because they're driven off the same
shaft rather than independent timers.

## One-sentence mechanic description
A small geared dial turns steadily while a pen traces an intensity curve
exactly in step with it, sweeping fast back to the start the instant a full
scan completes.

## Rendering approach
DOM + canvas hybrid, card-scale, geometry from the container's smaller
dimension. A small radial dial (DOM, simple tick marks + a single rotating
indicator line) sits to one side, mechanically described as geared 1:1 to
the trace's horizontal position — the dial's rotation fraction and the
canvas trace's x-position must be driven from the SAME underlying phase
variable, never two independently-tuned animations, so they can never drift
out of sync.

## Real numbers
- Real device: full grating sweep historically ~5 real minutes. This build
  uses a **10s sweep** (documented ratio: 1 app-second ≈ 30 real seconds),
  followed by a **1s flyback** (the grating's fast mechanical return
  stroke) before the next sweep begins — total cycle **11s**.
- Spectrum shape: procedural, 3-5 Gaussian-ish peaks (width 2-6% of sweep
  width, height 20-90% of chart height) over a low noise floor (±2%),
  regenerated with new peak positions each cycle so consecutive sweeps
  aren't identical.
- Dial rotation: 0° to 300° over the 10s sweep (leaving a 60° gap so the
  flyback reads as a visible snap back across that gap, not a full circle
  blending into itself), then 300°→0° over the 1s flyback.
- Pen/dial phase coupling: single `phase` value 0-1 per cycle drives both
  `dialAngle = phase * 300deg` (sweep) and `penX = phase * chartWidth`
  identically — enforced as one shared variable, not two synced timers.

## The resting loop
- **t0:** dial at 0°, trace empty, pen at left edge.
- **t=2.5s:** dial ~75° (phase 0.25), trace shows the noise floor plus
  possibly the leading edge of the first peak.
- **t=5s:** dial ~150° (phase 0.5), trace extends to the midpoint,
  visibly further than t=2.5s with at least one full peak likely traced.

## The reduced-motion freeze frame
Frozen at phase 0.4 (dial at 120°, mid-sweep, not during the flyback): two
of the procedural peaks fully traced, dial indicator visibly partway
through its 300° arc, remainder of the chart blank ahead of the pen — a
clearly mid-scan, geared-looking frame. Named `STATIC_PHASE = 0.4`.

## Interaction
None required. If hoverable, a hover over the dial or the trace may reveal
a DOM tooltip naming the synthetic "wavelength" at that phase — `--ns-accent`
permitted only on that tooltip/focus chrome, never mixed into the dial tick
or the trace ink.

## Light theme vs dark
Dial ticks and trace baseline use `--border`; trace ink and dial indicator
use `--foreground`. Peaks must stay legible above the noise floor in both
themes — verify the noise-floor-to-peak luminance delta doesn't collapse in
light theme, where the available contrast range against `--background` is
narrower than in dark theme.

## Kill criteria
- If the dial-to-pen gearing relationship isn't perceivable at card scale
  (dial and trace too small/far apart to read as connected), the entire
  mechanism reduces to "a line chart with a decorative spinning knob" —
  reject or redesign the layout (e.g. dial closer to the trace's leading
  edge) before shipping.
- If the 1s flyback isn't visually distinct from the 10s sweep (same
  speed, no snap), the "departure and arrival" legibility requirement from
  round 9 is unmet — reject until the flyback reads as an obviously faster,
  distinct motion.
- If reviewers read this as a restyle of an existing chart component once
  the dial is removed mentally, the wavelength-gearing identity has failed
  to carry the concept — kill.

## Legibility
The one thing to follow: **the dial's indicator line and the pen's
horizontal position staying in lockstep** — watching the dial cross a given
tick and the trace's leading edge cross the same fractional width at the
same instant. Cadence: 10s sweep + 1s flyback, 11s total, slow enough to
track the coupling across a full cycle.
