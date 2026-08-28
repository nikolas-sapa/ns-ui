# neon-tube-striation

- **tier:** core
- **product surface it replaces:** a horizontal section divider / rule — the plain `<hr>`-equivalent break between content blocks.

## the real mechanic
In the positive column of a glow-discharge tube (the long uniform-looking
segment of a lit neon tube, away from the electrodes), the plasma commonly
self-organizes into moving striations: alternating brighter and dimmer
bands along the tube's length caused by an ionization-wave instability in
the column. This is documented gas-discharge physics (moving/standing
striations in the positive column), not a decorative invention — the bands
drift slowly along the tube's axis at a roughly constant rate for a given
gas fill and pressure. Separately, electrode sputtering — cathode material
eroding and depositing on the inside of the glass near the tube ends —
causes the well-known gradual blackening/darkening visible near the
electrodes of an aged neon tube, most familiar from old neon signage and
fluorescent tube ends.

## one-sentence mechanic description
A lit neon-tube divider carries a band of striations that drift steadily
along its length, while faint dark patches slowly deepen near both ends
where the electrodes sit.

## rendering approach
2D canvas or DOM (a single `<canvas>` sized to the divider's box via
`w-full h-full`/style dimensions). Tube rendered as a horizontal rounded
capsule the width of the container. Luminance along the tube length is the
sum of: (1) a base "lit tube" luminance, (2) a traveling sinusoidal
striation modulation, (3) two fixed end-zone darkening masks that ramp in
over time and then hold.

## real numbers
- Striation wavelength: ~7% of tube length (yields 10-14 visible bands
  across a typical divider width).
- Drift rate: one full wavelength of phase advances across the tube every
  4000ms (i.e., phase advances 2π every 4s) — continuous, one direction.
- Striation contrast: bright/dark luminance ratio ~1.6:1 around the base
  tube luminance.
- Gas current noise: whole-tube luminance modulated ±3% at an aperiodic
  4-7Hz (resampled from smoothed noise, not tied 1:1 to the 60Hz paint
  loop).
- Electrode sputter darkening: two end zones, each the first/last 6% of
  tube length, darken from baseline toward -35% luminance over a 90s ramp
  (`1 - exp(-t/30s)` shape) and then hold — capped, not unbounded, so the
  component stays "lit and alive," not a tube slowly going dark forever.
- Tube capsule stroke width: derived from the container's smaller
  dimension (the divider's height), typically 3-6% of that dimension.

## the resting loop
- t0: striation phase 0, end-darkening near baseline (freshly "struck").
- 2.5s: striation phase advanced ~225°, visibly different band positions;
  end-darkening slightly deeper.
- 5s: striation phase advanced further still (differs from 2.5s by another
  ~112°), end-darkening measurably deeper than at t0.

## reduced-motion freeze frame
Freeze at striation phase 130° into the cycle — a phase where the bright
and dark bands sit asymmetrically across the tube's length (not the
phase-0 frame, which can look near-symmetric and less clearly "banded").
This is the most structured single frame for reading the striation pattern
at a glance.

## interaction
None. This is a passive divider; no pointer tracking, no hover state.

## light vs dark theme
Dark: tube base near `--foreground` at high luminance against a dark
`--background`, striation modulation multiplies that luminance. Light:
same token relationships, but the tube must still read as a distinctly
lit object against a light `--background` — its luminance floor (the
darkest striation trough) should stay meaningfully above `--background`
so the tube doesn't fade in and out of the page. Check light theme first;
a neon tube that goes invisible at its dimmest striation phase against a
light page is the way this concept dies.

## legibility
One thing to follow: a single striation band drifting along the tube's
length. Cadence: one full traverse of the visible pattern every 4s —
easily tracked with the eye, well clear of any strobe risk since it's a
smooth phase advance, not a discrete swap.

## kill criteria
- If, at typical divider height (thin), the striation bands compress below
  a perceptible width and just read as generic shimmer, this fails and
  should either widen the tube's minimum rendered height or be killed.
- If the end-darkening ramp is imperceptible against the striation
  animation (i.e., nobody would notice it without a screenshot diff over
  90s), cut it — a mechanic nobody can perceive doesn't earn its
  complexity budget.
- If light theme cannot hold the tube visibly "lit" through its full
  striation-contrast range without touching `--ns-accent`, kill it.
