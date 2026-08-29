# extrusion-die-cut

- **slug:** extrusion-die-cut
- **tier:** core

## Product surface
A loader/progress fill for long-running background jobs (upload processing,
batch export, render queue) — replaces a plain progress bar or spinner.

## The real mechanic
Pasta extrusion: dough is forced under continuous pressure through a bronze
or Teflon die plate. The die's texture (bronze = coarse, matte, drag-striated
surface; Teflon = smooth, glossy) is stamped into the rope as it exits. A
rotating guillotine blade sweeps across the die face at a fixed interval,
cutting the continuous rope into discrete lengths that drop away. Source:
commercial pasta extrusion (die-face cutting), the standard method for short
cut shapes (penne, fusilli feedstock) since the die-face cutter replaced
hand-cut rope lines.

## Mechanic description
A textured rope continuously advances from a die aperture and is sliced into
falling segments by a sweeping blade.

## Rendering approach
2D canvas, `w-full h-full`, DPR-capped at 1.5. Die face is a horizontal slot
sized to the container's smaller dimension × 0.08 (height) and 0.9 (width).
Rope surface texture: a 1D noise strip (die-drag striation) scrolling with
the extrusion, resampled onto the rope's advancing edge each frame.

## Real numbers
- Extrusion (rope advance) rate: 18 px/s at 1x container-height-normalized
  scale (rope crosses a card-width container in ~14s at 400px width).
- Blade sweep interval: one cut every 2.2s (well above the ~1s legibility
  floor, since a cut plus the resulting segment's fall-and-settle both need
  to read before the next one starts).
- Blade sweep duration: 220ms per stroke, eased (ease-in-out), not a blink.
- Cut segment count on screen at once: 4-6, each 90-140px long depending on
  cut-to-cut jitter (±8% on the 2.2s interval so the cadence doesn't feel
  metronomic — real die-cutters have minor speed hunting).
- Rope texture striation pitch: 3px, luminance variance ±6% of the base
  --foreground-derived value (subtle, not a hard stripe).
- Segments fall at 40 px/s² gravity accel after cut, settle into a loose
  stack at the container floor and fade out (400ms) once 6 have accumulated,
  so the stack never overflows the card.

## Resting loop
- t0: rope mid-advance, no segment mid-cut, 2-3 settled segments in the
  stack.
- 2.5s: a cut has fired (or is mid-stroke) and a new segment is either
  falling or freshly landed; stack composition visibly different.
- 5s: stack has cycled at least once (oldest segments faded, new ones
  present); rope has advanced a full visible length past its t0 position.

## Reduced-motion freeze
Freeze mid-cut: blade at 60% through its stroke, rope severed, the just-cut
segment separated from the rope by a visible 4px gap but not yet fallen —
the single most information-dense frame (shows die texture, the cut
mechanism, and a completed segment simultaneously).

## Interaction
None required (ambient loader). If used as a determinate progress indicator,
extrusion rate may scale with a `progress` prop (0-1) driving rope-advance
speed, but the blade cadence stays fixed — must NOT tie blade colour or rope
texture to `--ns-accent`; progress is communicated by advance rate and total
rope length only, never by hue/accent.

## Light vs dark
Rope and die rendered in luminance only: die face is `--ns-muted` at ~1.3:1
against `--background`; rope reads as `--foreground`-derived light-on-dark
or dark-on-light strip with the striation as a ±6% luminance ripple within
the rope's own tone, not a separate colour. `--border` never used as a fill
for rope or die — separator role only (may outline the die slot at its true
1.1:1 contrast).

## Legibility
The one thing to follow: the blade sweeping across the die face and
severing the rope. Cadence: one cut every 2.2s ± 8%, each stroke taking
220ms — slow enough to watch the blade travel, frequent enough to feel like
a running machine rather than a stalled one.

## Kill criteria
Reject if: the blade sweep reads as a blink rather than a travel (must be
visually traceable start-to-end); if rope texture requires colour to read
(must hold under pure luminance at both theme extremes); if this collapses
to "a progress bar with a texture" indistinguishable from existing dither
progress components (`progress-hatch`, `progress-wick`) — the cut event is
the differentiator and must remain the visual anchor.
