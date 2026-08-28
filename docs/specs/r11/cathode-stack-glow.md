# cathode-stack-glow

- **tier:** core
- **product surface it replaces:** a stat/metric readout tile — the single-number display in a dashboard hero stat, price, or counter card.

## the real mechanic
A Nixie tube stacks ten wire-mesh cathode digits (0-9), each shaped like the
numeral it represents, one behind the other, all viewed through a common
fine-wire anode mesh. Applying the tube's striking voltage to one cathode
ionizes the low-pressure neon around it and that digit glows; because the
cathodes are physically stacked and the mesh is fine but not opaque, the
unlit digits behind the glowing one remain faintly visible as ghost
outlines through the glow — a well-documented, distinctive Nixie viewing
artifact. Two further documented behaviors: cathode poisoning (sputtered
cathode material and residual gas impurities preferentially coat cathodes
that are rarely struck, dimming or thinning their glow over the tube's
life) and the standard mitigation, a "cathode conditioning" or
"anti-poisoning" cycle — clock and counter circuits built on Nixies
periodically sweep rapidly through all ten digits at low duty cycle,
independent of the displayed value, specifically to keep every cathode's
surface clean and its strike voltage low.

## one-sentence mechanic description
A wire-mesh numeral glows over the faint ghost outlines of the nine digits
stacked behind it, and every so often the display sweeps silently through
all ten to keep the unused ones from fouling.

## rendering approach
2D canvas or layered SVG per digit cell (component displays 1-N digit
cells side by side, e.g. for a price or counter). For each cell: render
all ten digit-glyph outlines (numeral strokes, not filled), stacked with a
tiny per-glyph offset (1-2px) to sell physical depth like the real stacked
mesh does. The active glyph renders at full luminance with a soft halo;
the other nine render as faint outline-only ghosts at low, per-digit-
varying opacity representing accumulated poisoning wear.

## real numbers
- Ghost opacity: base 3-7%, seeded per (cell, digit) pair and drifting
  slowly (±0.5%/minute, clamped 2-9%) to represent ongoing uneven wear —
  never fully static across the resting loop.
- Active-digit micro-flicker: brightness oscillates 92-100% at an
  aperiodic 3-6Hz (resampled from smoothed noise, not tied to the 60Hz
  paint loop), representing plasma current noise in a real glow discharge.
- Conditioning sweep: fires every 15-30s (randomized per cell so multiple
  cells in a row never sweep in lockstep), sweeping through digits 0-9 in
  order at 80ms/digit (rise 20ms, hold 40ms, fall 20ms), total sweep
  ~800ms, brightness during sweep matches the active-digit's idle peak so
  it reads as a real strike, not a dimmer flash.
- Halo radius on active digit: soft, ~8% of the cell's smaller dimension,
  pulsing ±10% synced to the micro-flicker.

## the resting loop
- t0: displayed digits lit steady with faint stacked ghost meshes visible
  behind each.
- 2.5s: micro-flicker has visibly varied brightness at least twice per
  cell (3-6Hz over 2.5s guarantees several visible cycles); ghost opacities
  have drifted slightly.
- 5s: a conditioning sweep has plausibly fired on at least one cell in a
  multi-digit display (15-30s period, staggered per cell — with 3+ cells
  the chance of catching one by 5s is meaningful); if not, flicker and
  ghost drift alone are still visibly different from t0.

## reduced-motion freeze frame
Freeze on the steady lit-digit state with the full ghost stack visible at
its median opacity (not mid-sweep, which would show a transiently wrong
numeral) — this is the most structured single frame because it's the one
that communicates the whole concept (correct number + stacked mesh depth)
without an ambiguous in-between state.

## interaction
None required; this is a passive readout. If used as a live-updating
counter, a value change should re-strike the new digit's cathode (a fast
20-30ms flash-up) rather than crossfading — a Nixie does not fade between
numerals, it switches which cathode is struck.

## light vs dark theme
Dark: `--background` near-black, active glyph in `--foreground` near-white
with halo blending toward `--background`; ghosts in `--ns-muted` at low
opacity. Light: same relationships, but ghost opacity needs to sit at the
higher end of its range (6-9% rather than 3-5%) since faint marks recede
faster against a light `--background` than a dark one — verify ghosts are
still perceptible in light theme, not just present in the DOM.

## legibility
One thing to follow: the brief conditioning sweep, when it happens — a
visible ripple of glow through all ten stacked digit positions in one
cell before settling back to the correct number. Cadence: one sweep per
cell every 15-30s, ~800ms to complete, with a clear start (first digit
lights) and end (correct digit re-settles) — not a blink.

## kill criteria
- If the ghost-stack effect is imperceptible at typical stat-tile card
  size (small digit cells), this should not ship — it would just be "a
  number with slightly fuzzy edges," which is a restyle, not a mechanic.
- If micro-flicker at 3-6Hz reads as a rendering glitch rather than gas
  noise (test against a plain static digit side-by-side), tune amplitude
  down or kill.
- If the conditioning sweep interval has to drop below ~10s to feel "alive
  enough," it violates the ~1s-between-events legibility cadence at a
  finer grain and should be reworked, not shipped as a fast strobe.
